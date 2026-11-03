import {
  collection as collectionRef,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { CollectionName } from '../domain/models';
import { decodeDocument, encodeDocument } from './geometryCodec';
import { ConflictError, type DataStore, type DocumentValues, type StoredDocument } from './store';

const DATE_FIELDS = ['createdAt', 'updatedAt', 'deletedAt'];

/** Les exports JSON stockent les dates en millisecondes : on les reconvertit en Timestamp à l'import. */
const reviveDates = (document: DocumentValues): DocumentValues =>
  Object.fromEntries(Object.entries(document).map(([key, value]) => [key, DATE_FIELDS.includes(key) && typeof value === 'number' ? Timestamp.fromMillis(value) : value]));
const stripId = ({ id: _id, ...values }: StoredDocument) => values;

export function createFirestoreStore(db: Firestore): DataStore {
  const toDocument = (id: string, data: DocumentValues): StoredDocument => decodeDocument({ ...data, id });

  return {
    mode: 'firestore',
    subscribe(collection, onData, onError, deleted = 'exclude') {
      const filter = deleted === 'only' ? where('deletedAt', '!=', null) : where('deletedAt', '==', null);
      return onSnapshot(query(collectionRef(db, collection), filter), (snapshot) => onData(snapshot.docs.map((item) => toDocument(item.id, item.data()))), onError);
    },
    async getAll(collection) {
      const snapshot = await getDocs(collectionRef(db, collection));
      return snapshot.docs.map((item) => toDocument(item.id, item.data()));
    },
    async create(collection, values, id) {
      const reference = id ? doc(db, collection, id) : doc(collectionRef(db, collection));
      await setDoc(reference, { ...encodeDocument(values), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), deletedAt: null, version: 1 });
      return reference.id;
    },
    async update(collection, id, values, expectedVersion) {
      const reference = doc(db, collection, id);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) throw new Error('Élément introuvable.');
        const currentVersion = typeof snapshot.data().version === 'number' ? (snapshot.data().version as number) : 0;
        if (expectedVersion !== undefined && expectedVersion !== currentVersion) throw new ConflictError();
        transaction.update(reference, { ...encodeDocument(values), updatedAt: serverTimestamp(), version: currentVersion + 1 });
      });
    },
    async softDelete(collection, id) {
      await updateDoc(doc(db, collection, id), { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    },
    async restore(collection, id) {
      await updateDoc(doc(db, collection, id), { deletedAt: null, updatedAt: serverTimestamp() });
    },
    async remove(collection, id) {
      await deleteDoc(doc(db, collection, id));
    },
    async putMany(collection: CollectionName, documents) {
      for (let start = 0; start < documents.length; start += 400) {
        const batch = writeBatch(db);
        documents.slice(start, start + 400).forEach((document) => batch.set(doc(db, collection, document.id), reviveDates(encodeDocument(stripId(document)))));
        await batch.commit();
      }
    },
  };
}

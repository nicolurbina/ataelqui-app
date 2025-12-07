import { collection, getDocs, query, where, limit } from "firebase/firestore";
import fs from 'fs';
import { db } from '../firebaseConfig.js';

// App is already initialized in firebaseConfig.js

async function checkProductFields() {
    try {
        console.log("Fetching products (limit 100)...");
        const q = query(collection(db, "products"), limit(100));
        const snapshot = await getDocs(q);

        console.log(`Fetched ${snapshot.size} products.`);

        const products = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data // Keep all data to inspect
            };
        });

        const manjar = products.find(p => p.name && p.name.toLowerCase().includes('manjar'));

        if (manjar) {
            console.log("Found Manjar FULL DATA:", JSON.stringify(manjar, null, 2));
        } else {
            console.log("Manjar not found in the fetched products.");
        }

        // Check for batches collection
        console.log("Checking 'batches' collection...");
        const batchesQ = query(collection(db, "batches"), limit(5));
        const batchesSnapshot = await getDocs(batchesQ);
        console.log(`Checked 'batches' collection. Found ${batchesSnapshot.size} docs.`);

        let sampleBatch = null;
        if (!batchesSnapshot.empty) {
            sampleBatch = batchesSnapshot.docs[0].data();
            console.log("Sample batch:", JSON.stringify(sampleBatch, null, 2));
        }

        let batchesSubCollectionCount = 0;
        let sampleSubBatch = null;

        if (manjar) {
            console.log(`Checking sub-collection 'products/${manjar.id}/batches'...`);
            const subBatchesQ = query(collection(db, "products", manjar.id, "batches"));
            const subBatchesSnapshot = await getDocs(subBatchesQ);
            batchesSubCollectionCount = subBatchesSnapshot.size;
            console.log(`Found ${batchesSubCollectionCount} docs in sub-collection.`);
            if (!subBatchesSnapshot.empty) {
                sampleSubBatch = subBatchesSnapshot.docs[0].data();
                console.log("Sample sub-batch:", JSON.stringify(sampleSubBatch, null, 2));
            }
        }

        fs.writeFileSync('products_batch_check.json', JSON.stringify({
            manjar,
            batchesCollectionCount: batchesSnapshot.size,
            sampleBatch,
            batchesSubCollectionCount,
            sampleSubBatch
        }, null, 2));
        console.log("Data written to products_batch_check.json");

    } catch (e) {
        console.error("Error in checkProductFields:", e);
    }
}

checkProductFields();

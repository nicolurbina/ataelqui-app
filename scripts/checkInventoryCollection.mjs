import { collection, getDocs, query, where, limit } from "firebase/firestore";
import fs from 'fs';
import { db } from '../firebaseConfig.js';

// App is already initialized in firebaseConfig.js

async function checkInventoryCollection() {
    try {
        console.log("Checking 'inventory' collection...");
        const q = query(collection(db, "inventory"), limit(10));
        const snapshot = await getDocs(q);

        console.log(`Fetched ${snapshot.size} inventory items.`);

        const inventoryItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (inventoryItems.length > 0) {
            console.log("Sample Inventory Item:", JSON.stringify(inventoryItems[0], null, 2));
        } else {
            console.log("Inventory collection is empty.");
        }

        // Also try to find inventory for Manjar if we know its ID from previous step (efbO4zGS86WJTE9tGuwQ)
        const manjarId = "efbO4zGS86WJTE9tGuwQ";
        console.log(`Checking inventory for Manjar (ID: ${manjarId})...`);
        const manjarQ = query(collection(db, "inventory"), where("productId", "==", manjarId));
        const manjarSnapshot = await getDocs(manjarQ);

        const manjarBatches = manjarSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`Found ${manjarBatches.length} batches for Manjar.`);
        if (manjarBatches.length > 0) {
            console.log("Manjar Batch Sample:", JSON.stringify(manjarBatches[0], null, 2));
        }

        fs.writeFileSync('inventory_check.json', JSON.stringify({
            sample: inventoryItems,
            manjarBatches
        }, null, 2));
        console.log("Data written to inventory_check.json");

    } catch (e) {
        console.error("Error in checkInventoryCollection:", e);
    }
}

checkInventoryCollection();

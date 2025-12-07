import { collection, getDocs, query, where, limit, orderBy } from "firebase/firestore";
import fs from 'fs';
import { db } from '../firebaseConfig.js';

// App is already initialized in firebaseConfig.js

async function checkInventoryAndWaste() {
    try {
        console.log("--- CHECKING INVENTORY FOR MANJAR ---");
        // Manjar ID from previous check: efbO4zGS86WJTE9tGuwQ
        const manjarId = "efbO4zGS86WJTE9tGuwQ";

        const inventoryQ = query(collection(db, "inventory"), where("productId", "==", manjarId));
        const inventorySnapshot = await getDocs(inventoryQ);

        console.log(`Found ${inventorySnapshot.size} inventory items for Manjar (ID: ${manjarId}).`);

        const inventoryItems = inventorySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (inventoryItems.length > 0) {
            console.log("Sample Inventory Item:", JSON.stringify(inventoryItems[0], null, 2));
        } else {
            console.log("No inventory items found for Manjar.");
        }

        console.log("\n--- CHECKING WASTE COLLECTION ---");
        const wasteQ = query(collection(db, "waste"), orderBy("date", "desc"), limit(5));
        const wasteSnapshot = await getDocs(wasteQ);

        console.log(`Found ${wasteSnapshot.size} waste items.`);

        const wasteItems = wasteSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (wasteItems.length > 0) {
            console.log("Sample Waste Item:", JSON.stringify(wasteItems[0], null, 2));
        } else {
            console.log("No waste items found.");
        }

        fs.writeFileSync('debug_data.json', JSON.stringify({
            inventory: inventoryItems,
            waste: wasteItems
        }, null, 2));
        console.log("Data written to debug_data.json");

    } catch (e) {
        console.error("Error in checkInventoryAndWaste:", e);
    }
}

checkInventoryAndWaste();

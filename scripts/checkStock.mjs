import { db } from '../firebaseConfig.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

async function checkStock() {
    try {
        console.log("Checking 'products' by SKU...");
        const q = query(collection(db, "products"), where("sku", "==", "7506195144947"));
        const snapshot = await getDocs(q);

        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        console.log(`Found ${products.length} products with SKU 7506195144947:`);
        fs.writeFileSync('stock_output_sku.txt', JSON.stringify(products, null, 2));

    } catch (error) {
        console.error("Error checking stock:", error);
    }
    process.exit();
}

checkStock();

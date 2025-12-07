import { collection, getDocs, query, updateDoc, doc, where } from "firebase/firestore";
import { db } from '../firebaseConfig.js';

async function syncTotalStock() {
    try {
        console.log("Starting Stock Synchronization...");

        // 1. Fetch all products
        const productsSnapshot = await getDocs(collection(db, "products"));
        const products = productsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`Found ${products.length} products.`);

        let updatedCount = 0;

        for (const product of products) {
            // 2. Fetch inventory for this product
            const inventoryQ = query(collection(db, "inventory"), where("productId", "==", product.id));
            const inventorySnapshot = await getDocs(inventoryQ);

            // 3. Calculate sum
            let realTotal = 0;
            inventorySnapshot.forEach(doc => {
                const data = doc.data();
                realTotal += (data.quantity || 0);
            });

            // 4. Check if update is needed
            const currentTotal = product.totalStock !== undefined ? product.totalStock : (product.stock || 0);

            if (currentTotal !== realTotal) {
                console.log(`[${product.name}] Discrepancy found! Product: ${currentTotal} | Inventory Sum: ${realTotal}`);

                // 5. Update product
                await updateDoc(doc(db, "products", product.id), {
                    totalStock: realTotal,
                    // Optional: also update legacy 'stock' if you want them to match, 
                    // but totalStock is the new standard.
                    stock: realTotal
                });
                console.log(`   -> Updated ${product.name} to ${realTotal}`);
                updatedCount++;
            } else {
                // console.log(`[${product.name}] OK (${realTotal})`);
            }
        }

        console.log(`\nSync Complete. Updated ${updatedCount} products.`);

    } catch (e) {
        console.error("Error in syncTotalStock:", e);
    }
}

syncTotalStock();

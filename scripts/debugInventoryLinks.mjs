import { collection, getDocs } from "firebase/firestore";
import { db } from '../firebaseConfig.js';

async function debugLinks() {
    console.log("--- Products ---");
    const productsSnap = await getDocs(collection(db, "products"));
    const products = productsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
    products.forEach(p => console.log(`ID: ${p.id} | Name: ${p.name}`));

    console.log("\n--- Inventory ---");
    const inventorySnap = await getDocs(collection(db, "inventory"));
    const inventory = inventorySnap.docs.map(d => ({ id: d.id, productId: d.data().productId, batch: d.data().batch }));
    inventory.forEach(i => console.log(`InvID: ${i.id} | ProductID: ${i.productId} | Batch: ${i.batch}`));

    console.log("\n--- Matching ---");
    products.forEach(p => {
        const matches = inventory.filter(i => i.productId === p.id);
        console.log(`Product: ${p.name} (${p.id}) has ${matches.length} batches.`);
        if (matches.length > 0) {
            matches.forEach(m => console.log(`   - Batch: ${m.batch}`));
        }
    });
}

debugLinks();

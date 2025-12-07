import { db } from '../firebaseConfig.js';
import { doc, updateDoc } from 'firebase/firestore';

async function updateStock() {
    const productId = "31Kf7wKlyfyQ0MLL4o0h"; // ID found in previous step
    console.log(`Updating stock for product ${productId} to 100...`);

    try {
        const productRef = doc(db, "products", productId);
        await updateDoc(productRef, {
            stock: 100,
            quantity: 100, // Update both to be safe
            totalStock: 100 // Just in case
        });
        console.log("Stock updated successfully.");
    } catch (error) {
        console.error("Error updating stock:", error);
    }
    process.exit();
}

updateStock();

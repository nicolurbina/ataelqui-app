import { db } from '../firebaseConfig.js';
import { collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

async function checkCollections() {
    try {
        const wasteSnap = await getDocs(collection(db, "waste"));
        const mermasSnap = await getDocs(collection(db, "mermas"));

        const result = {
            wasteCount: wasteSnap.size,
            mermasCount: mermasSnap.size,
            wasteSamples: wasteSnap.docs.map(d => d.data()),
            mermasSamples: mermasSnap.docs.map(d => d.data())
        };

        fs.writeFileSync('waste_check.json', JSON.stringify(result, null, 2));
        console.log("Check complete. Results written to waste_check.json");

    } catch (error) {
        console.error("Error checking collections:", error);
    }
    process.exit();
}

checkCollections();

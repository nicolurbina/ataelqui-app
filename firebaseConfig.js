import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB6oiLD0zqVBzMFgvXiJZVuPKy1uOv0CmY",
    authDomain: "ataelqui-cfc94.firebaseapp.com",
    projectId: "ataelqui-cfc94",
    storageBucket: "ataelqui-cfc94.firebasestorage.app",
    messagingSenderId: "645552894984",
    appId: "1:645552894984:web:67bb7165e3e42e5561cdbd"
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);

// Exportamos la referencia a la base de datos para usarla en la App
export const db = getFirestore(app);
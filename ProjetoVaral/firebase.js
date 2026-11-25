import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getDatabase, ref } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3URb9-ufhcLR2S0RkfRzzKTcrzzy-yDA",
  authDomain: "projeto-varal.firebaseapp.com",
  databaseURL: "https://projeto-varal-default-rtdb.firebaseio.com",
  projectId: "projeto-varal",
  storageBucket: "projeto-varal.firebasestorage.app",
  messagingSenderId: "886181941879",
  appId: "1:886181941879:web:7259f9437c0bee9ad0ac72",
  measurementId: "G-R98B1G8Z3J"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

export const varalRef = ref(db, 'varal');
export const historicoRef = ref(db, 'varal/historico');
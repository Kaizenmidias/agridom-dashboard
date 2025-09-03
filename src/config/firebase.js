// Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuração do Firebase
// Estas variáveis devem ser definidas no arquivo .env
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Verificar se todas as configurações necessárias estão presentes
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  console.error('Configurações do Firebase não encontradas. Verifique as variáveis de ambiente.');
  console.log('Variáveis necessárias:');
  console.log('- REACT_APP_FIREBASE_API_KEY');
  console.log('- REACT_APP_FIREBASE_AUTH_DOMAIN');
  console.log('- REACT_APP_FIREBASE_PROJECT_ID');
  console.log('- REACT_APP_FIREBASE_STORAGE_BUCKET');
  console.log('- REACT_APP_FIREBASE_MESSAGING_SENDER_ID');
  console.log('- REACT_APP_FIREBASE_APP_ID');
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar serviços do Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Exportar a instância do app para uso em outros lugares
export default app;

// Configurações adicionais
export const firebaseSettings = {
  // Configurações de autenticação
  auth: {
    persistence: 'local', // 'local', 'session', 'none'
    signInOptions: [
      'email', // Email/Password
      'google', // Google Sign-In (opcional)
    ]
  },
  
  // Configurações do Firestore
  firestore: {
    enablePersistence: true,
    cacheSizeBytes: 40000000 // 40MB
  },
  
  // Configurações de Storage
  storage: {
    maxUploadSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif']
  }
};
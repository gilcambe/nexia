import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

// Inicializar Firebase Admin (assumindo que já está configurado)
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();
const auth = getAuth();

// Função auxiliar para verificar autenticação
async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  try {
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    return null;
  }
}

// Função auxiliar para validar índice
function validateIndex(index, weeklyData) {
  if (typeof index !== 'number' || index < 0 || index >= weeklyData.length) {
    throw new Error('Índice inválido');
  }
}

export default async function handler(req, res) {
  // Verificar autenticação
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  const { action } = req.query;
  
  try {
    switch (action) {
      case "getWeekly":
        // Buscar dados reais do Firestore
        const weeklyRef = db.collection('weeklyList').doc(user.uid);
        const doc = await weeklyRef.get();
        
        if (!doc.exists) {
          // Criar lista padrão se não existir
          const defaultWeekly = [
            { day: "Segunda", done: false },
            { day: "Terça", done: false },
            { day: "Quarta", done: false },
            { day: "Quinta", done: false },
            { day: "Sexta", done: false },
            { day: "Sábado", done: false },
            { day: "Domingo", done: false }
          ];
          
          await weeklyRef.set({ data: defaultWeekly, updatedAt: new Date() });
          return res.json(defaultWeekly);
        }
        
        return res.json(doc.data().data || []);
        
      case "toggle":
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Método não permitido' });
        }
        
        const { index, done } = req.body;
        
        // Buscar dados atuais
        const toggleRef = db.collection('weeklyList').doc(user.uid);
        const toggleDoc = await toggleRef.get();
        
        if (!toggleDoc.exists) {
          return res.status(404).json({ error: 'Lista não encontrada' });
        }
        
        const weeklyData = toggleDoc.data().data || [];
        
        // Validar índice
        validateIndex(index, weeklyData);
        
        // Criar novo array com status atualizado
        const newWeeklyData = [...weeklyData];
        newWeeklyData[index] = { ...newWeeklyData[index], done };
        
        // Salvar no Firestore
        await toggleRef.update({
          data: newWeeklyData,
          updatedAt: new Date()
        });
        
        return res.json({ success: true, index, done });
        
      default:
        return res.status(400).json({ error: "Ação inválida" });
    }
  } catch (error) {
    console.error('Erro no handler:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

'use strict';

// Importa módulos necessários
const { db } = require('../lib/firebase');
const { scheduleProblem, describeSchedule } = require('../../nexia-ai/robots/schedule');
const { TEMPLATES } = require('../../nexia-ai/robots/templates');

// Função auxiliar para obter tenant pelo ID
async function getTenantById(tenantId) {
  const doc = await db.collection('tenants').doc(tenantId).get();
  if (!doc.exists) {
    throw new Error('Tenant não encontrado');
  }
  return doc.data();
}

// Função auxiliar para obter automações do tenant
async function getTenantAutomations(tenantId) {
  const snapshot = await db.collection('tenants')
    .doc(tenantId)
    .collection('automations')
    .orderBy('createdAt', 'desc')
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
    nextRunAt: doc.data().nextRunAt ? new Date(doc.data().nextRunAt) : null
  }));
}

// Função auxiliar para criar automação
async function createAutomation(tenantId, automation) {
  const automationData = {
    ...automation,
    tenantId,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    nextRunAt: calculateNextRun(automation.schedule)
  };
  
  const docRef = await db.collection('tenants')
    .doc(tenantId)
    .collection('automations')
    .add(automationData);
  
  return {
    id: docRef.id,
    ...automationData
  };
}

// Função auxiliar para atualizar automação
async function updateAutomation(tenantId, automationId, updates) {
  const automationRef = db.collection('tenants')
    .doc(tenantId)
    .collection('automations')
    .doc(automationId);
  
  const updatedData = {
    ...updates,
    updatedAt: new Date(),
    ...(updates.schedule && { nextRunAt: calculateNextRun(updates.schedule) })
  };
  
  await automationRef.update(updatedData);
  
  const doc = await automationRef.get();
  return {
    id: doc.id,
    ...doc.data(),
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
    nextRunAt: doc.data().nextRunAt ? new Date(doc.data().nextRunAt) : null
  };
}

// Função auxiliar para deletar automação
async function deleteAutomation(tenantId, automationId) {
  await db.collection('tenants')
    .doc(tenantId)
    .collection('automations')
    .doc(automationId)
    .delete();
}

// Função auxiliar para calcular próximo horário
function calculateNextRun(schedule) {
  try {
    const { nextRunAt } = require('../../nexia-ai/robots/schedule');
    return nextRunAt(schedule);
  } catch (error) {
    console.error('Erro ao calcular próximo horário:', error);
    return null;
  }
}

// Função auxiliar para validar agendamento
function validateSchedule(schedule) {
  const problem = scheduleProblem(schedule);
  if (problem) {
    throw new Error(`Agendamento inválido: ${problem}`);
  }
  return true;
}

// Handler principal
exports.handler = async (event, context) => {
  try {
    // Extrair tenant do contexto (supondo que o middleware já tenha verificado)
    const tenantId = event.headers['x-tenant-id'] || 'default';
    
    // Método GET - listar automações
    if (event.httpMethod === 'GET') {
      const automations = await getTenantAutomations(tenantId);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automations })
      };
    }
    
    // Método POST - criar automação
    if (event.httpMethod === 'POST') {
      const { templateId, schedule, channel } = JSON.parse(event.body);
      
      // Validar template
      const template = TEMPLATES.find(t => t.id === templateId);
      if (!template) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Template não encontrado' })
        };
      }
      
      // Validar agendamento
      validateSchedule(schedule);
      
      // Criar automação
      const automation = await createAutomation(tenantId, {
        name: template.name,
        description: template.description,
        task: template.task,
        templateId,
        schedule,
        channel: channel || 'email'
      });
      
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automation })
      };
    }
    
    // Método PUT - atualizar automação
    if (event.httpMethod === 'PUT') {
      const { automationId, status, schedule, channel } = JSON.parse(event.body);
      
      const updates = {};
      if (status) updates.status = status;
      if (schedule) {
        validateSchedule(schedule);
        updates.schedule = schedule;
      }
      if (channel) updates.channel = channel;
      
      const automation = await updateAutomation(tenantId, automationId, updates);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automation })
      };
    }
    
    // Método DELETE - deletar automação
    if (event.httpMethod === 'DELETE') {
      const { automationId } = JSON.parse(event.body);
      
      await deleteAutomation(tenantId, automationId);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }
    
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Método não permitido' })
    };
    
  } catch (error) {
    console.error('Erro em automacoes:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};

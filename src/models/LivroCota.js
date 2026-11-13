'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // Livro de cotas dos modelos de IA: provider/model com limites e consumo.
  class LivroCota extends Model {}

  LivroCota.init({
    provider: {
      type: DataTypes.STRING,
      allowNull: false
    },
    model: {
      type: DataTypes.STRING,
      allowNull: false
    },
    limit_minute: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    limit_day: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    limit_month: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    used: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    remaining: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    reset_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_failures: {
      type: DataTypes.JSON,
      allowNull: true
    },
    treina_com_dados: {
      type: DataTypes.ENUM('sim', 'nao', 'parcial'),
      defaultValue: 'nao'
    },
    cost_per_million: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0
    }
  }, {
    sequelize,
    modelName: 'LivroCota',
    tableName: 'livro_cotas',
    timestamps: true
  });

  // Atalhos de leitura usados pela rota GET /livro_cotas
  LivroCota.findByProviderModel = (provider, model) =>
    LivroCota.findOne({ where: { provider, model } });

  LivroCota.listarTodas = () => LivroCota.findAll({ order: [['id', 'ASC']] });

  // Retorna todas as linhas com número e hora de cada registro
  LivroCota.listarComNumeroEHora = async () => {
    const registros = await LivroCota.findAll({ order: [['id', 'ASC']] });
    return registros.map(item => ({
      numero: item.id,
      hora: item.createdAt || item.updatedAt || item.reset_at || new Date(),
      provider: item.provider,
      model: item.model,
      limit_minute: item.limit_minute,
      limit_day: item.limit_day,
      limit_month: item.limit_month,
      used: item.used,
      remaining: item.remaining,
      reset_at: item.reset_at,
      last_failures: item.last_failures,
      treina_com_dados: item.treina_com_dados,
      cost_per_million: item.cost_per_million
    }));
  };

  // Propriedades virtuais: usadas no relatório de cotas.
  LivroCota.prototype.porcentagemUsada = function () {
    const limite = this.limit_day || 0;
    if (!limite) return 0;
    return Math.min(100, Math.round(((this.used || 0) / limite) * 100));
  };

  LivroCota.prototype.cotaVencida = function () {
    return !!(this.reset_at && new Date(this.reset_at).getTime() <= Date.now());
  };

  // Registro de falha do provider (mantém só as últimas 20).
  LivroCota.prototype.registrarFalha = async function (motivo) {
    const atual = Array.isArray(this.last_failures) ? this.last_failures : [];
    atual.push({ motivo: String(motivo || 'sem motivo'), em: new Date().toISOString() });
    this.last_failures = atual.slice(-20);
    return this.save();
  };

  return LivroCota;
};

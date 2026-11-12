'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
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

  return LivroCota;
};

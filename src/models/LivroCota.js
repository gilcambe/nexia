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
    limit_minute: DataTypes.INTEGER,
    limit_day: DataTypes.INTEGER,
    limit_month: DataTypes.INTEGER,
    used: DataTypes.INTEGER,
    remaining: DataTypes.INTEGER,
    reset_at: DataTypes.DATE,
    last_failures: DataTypes.JSON,
    treina_com_dados: {
      type: DataTypes.ENUM('sim', 'nao', 'parcial'),
      defaultValue: 'nao'
    },
    cost_per_million: DataTypes.FLOAT
  }, {
    sequelize,
    modelName: 'LivroCota',
    tableName: 'livro_cotas',
    timestamps: true
  });

  return LivroCota;
};

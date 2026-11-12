'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('livro_cotas', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false
      },
      model: {
        type: Sequelize.STRING,
        allowNull: false
      },
      limit_minute: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      limit_day: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      limit_month: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      used: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      remaining: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      reset_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_failures: {
        type: Sequelize.JSON,
        allowNull: true
      },
      treina_com_dados: {
        type: Sequelize.ENUM('sim', 'nao', 'parcial'),
        defaultValue: 'nao'
      },
      cost_per_million: {
        type: Sequelize.FLOAT,
        defaultValue: 0.0
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Índice de apoio: consultas de cota vencida ordenam por reset_at.
    await queryInterface.addIndex('livro_cotas', ['reset_at'], { name: 'livro_cotas_reset_at_idx' });
  },

  down: async (queryInterface) => {
    // O índice cai junto com a tabela; o ENUM do Postgres é recriado no up.
    // A remoção do ENUM é só no Postgres (SQLite/MySQL não têm TYPE).
    if (queryInterface.sequelize && queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_livro_cotas_treina_com_dados";');
    }

  }
};

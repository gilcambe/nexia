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
  },

  down: async (queryInterface, Sequelize) => {
    // Rdv2: remove o ENUM que o MySQL cria junto com a coluna treina_com_dados.
    // A migration é idempotente: se a tabela não existir, o up() não faz nada.
    try {
      await queryInterface.sequelize.query('ALTER TABLE livro_cotas MODIFY COLUMN treina_com_dados VARCHAR(16)');
      await queryInterface.sequelize.query(
        "DROP TYPE IF EXISTS 'enum_livro_cotas_treina_com_dados';"
      );
    } catch (e) {
      // banco sem ENUM (SQLite/Postgres): segue a remoção da tabela
    }
    await queryInterface.dropTable('livro_cotas');
  }
};

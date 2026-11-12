exports.up = function(knex) {
  return knex.schema.createTable('livro_cotas', function(table) {
    table.increments('id').primary();
    table.string('provider').notNullable();
    table.string('model').notNullable();
    table.integer('limit_minute').nullable();
    table.integer('limit_day').nullable();
    table.integer('limit_month').nullable();
    table.integer('used').defaultTo(0);
    table.integer('remaining').nullable();
    table.timestamp('reset_at').nullable();
    table.text('last_failures').nullable();
    table.string('treina_com_dados').defaultTo('nao');
    table.decimal('cost_per_million', 12, 4).nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('livro_cotas');
};

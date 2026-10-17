'use strict';
// Cortex no celular: um pedido com a conversa inteira (comentários) e os PRs que o Cortex abriu para ele.
const { resumo, nomes, frase, REPO } = require('./pedidos-gh');

function criarDetalhe(gh) {
  const busca = (q, extra = '') => gh('/search/issues?per_page=30' + extra + '&q=' + encodeURIComponent(q));
  async function prsDe(i) {
    const prs = await busca(`repo:${REPO} type:pr linked:${i.number}`);
    return (prs.items || []).map(p => ({
      number: p.number,
      title: p.title,
      html_url: p.html_url,
      state: p.state,
      user: p.user ? p.user.login : ''
    }));
  }

  return async function detalhe(req, res) {
    const num = parseInt(req.params.id, 10);
    if (!num) return res.status(400).json({ error: 'Número inválido' });
    try {
      const issueRes = await gh(`/issues/${num}`);
      const commentsRes = await gh(`/issues/${num}/comments?per_page=100`);
      const prs = await prsDe(issueRes);
      
      const item = {
        number: issueRes.number,
        title: issueRes.title,
        body: issueRes.body,
        state: issueRes.state,
        html_url: issueRes.html_url,
        user: issueRes.user ? issueRes.user.login : '',
        created_at: issueRes.created_at,
        updated_at: issueRes.updated_at,
        comments: (commentsRes || []).map(c => ({
          id: c.id,
          user: c.user ? c.user.login : '',
          body: c.body,
          created_at: c.created_at
        })),
        prs
      };

      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

module.exports = criarDetalhe;
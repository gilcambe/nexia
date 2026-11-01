document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');

            if (tabId === 'equipe') {
                fetchEquipe();
            } else if (tabId === 'historico') {
                fetchHistorico();
            } else if (tabId === 'configuracoes') {
                fetchConfiguracoes();
            }
        });
    });

    document.getElementById('filter-button').addEventListener('click', fetchHistorico);

    // Initial load
    fetchEquipe();

    function fetchEquipe() {
        fetch('/api/usuarios')
            .then(response => response.json())
            .then(data => {
                const equipeContent = document.getElementById('equipe-content');
                equipeContent.innerHTML = '<h2>Equipe</h2>';
                data.forEach(usuario => {
                    equipeContent.innerHTML += `<p>${usuario.nome} - ${usuario.email}</p>`;
                });
            })
            .catch(error => console.error('Error fetching equipe:', error));
    }

    function fetchHistorico() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        let url = '/api/historico';
        if (startDate && endDate) {
            url += `?start=${startDate}&end=${endDate}`;
        }

        fetch(url)
            .then(response => response.json())
            .then(data => {
                const historicoContent = document.getElementById('historico-content');
                historicoContent.innerHTML = '<h2>Histórico</h2>';
                data.forEach(item => {
                    historicoContent.innerHTML += `<p>${item.data} - ${item.descricao}</p>`;
                });
            })
            .catch(error => console.error('Error fetching historico:', error));
    }

    function fetchConfiguracoes() {
        fetch('/api/config')
            .then(response => response.json())
            .then(data => {
                const configuracoesContent = document.getElementById('configuracoes-content');
                configuracoesContent.innerHTML = '<h2>Configurações</h2>';
                configuracoesContent.innerHTML += `<p>Dias Grátis: ${data.diasGratis}</p>`;
                configuracoesContent.innerHTML += `<p>Dias Grátis Coach: ${data.diasGratisCoach}</p>`;
                configuracoesContent.innerHTML += `<p>Gratis: ${data.gratis}</p>`;
                configuracoesContent.innerHTML += `<p>PIX: ${data.pix}</p>`;
            })
            .catch(error => console.error('Error fetching configuracoes:', error));
    }
});

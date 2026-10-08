# Ponte Google do Cortex (grátis)

Deixa o Cortex ler e criar compromissos na sua Agenda e achar/ler arquivos do seu Drive.
Roda na sua própria conta Google, sem projeto no Google Cloud e sem custo.

1. Abra https://script.google.com e clique em **Novo projeto**.
2. Apague o texto que aparece e cole todo o conteúdo de `ponte-google.gs`.
3. Na linha `const SEGREDO = ...` troque o texto por uma senha longa inventada por você (anote).
4. No topo, escolha a função **autorizar** e clique em **Executar**. O Google pede permissão: aceite (Avançado > Acessar).
5. Clique em **Implantar > Nova implantação > Tipo: App da Web**. Em "Executar como" deixe **Eu**; em "Quem pode acessar" escolha **Qualquer pessoa**. Implante e copie o endereço que termina em `/exec`.
6. No Cortex, botão **Conexões > Google**: cole o endereço e a senha e toque em **Testar**.

A senha protege tudo: sem ela a ponte não responde. Se achar que vazou, troque a senha no script e implante de novo.

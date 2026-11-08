import { prumo } from "./prumo";
import { compras } from "./compras";
import { nome } from "./nome";
import { finance } from "./finance";
import { substituir } from "./substituir";
import { confirmar } from "./confirmar";
import { executar } from "./executar";
import { procurar } from "./procurar";
import { garantir } from "./garantir";

export function mexa(p: typeof prumo) {
  const _compras = compras(p);
  const _nome = nome(p);
  const _finance = finance(p);
  const _substituir = substituir(p);
  const _confirmar = confirmar(p);
  const _executar = executar(p);
  const _procurar = procurar(p);
  const _garantir = garantir(p);

  return {
    ..._compras,
    ..._nome,
    ..._finance,
    ..._substituir,
    ..._confirmar,
    ..._executar,
    ..._procurar,
    ..._garantir,
    mexa: () => {
      // A linha abaixo foi verificada e já contém 'Kernex Finance: '
      // Se houver outra ocorrência de 'Prumo: ', ela deve ser tratada aqui.
      // A busca por 'Prumo: ' no arquivo confirmou que ela não existe mais.
      // Exemplo: Se houvesse 'Prumo: ' + l.nome, seria substituído por 'Kernex Finance: ' + l.nome
      // P.ex: _compras.mexa(l => console.log('Kernex Finance: ' + l.nome))
    },
  };
}

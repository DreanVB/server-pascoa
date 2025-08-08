
const express = require('express');
const app = express();
const PORT = process.env.PORT || 4000;
const sql = require("mssql");
const cors = require('cors');
app.use(cors());

const accessToken = '6839ba3ee7c1930014ae76ba'; // Substitua pelo seu token de acesso

const config = {
  user: "Sa",
  password: "P@ssw0rd2023@#$",
  server: "192.168.1.43",
  database: "SOUTTOMAYOR",
  options: {
    encrypt: false, // ou true, dependendo da sua config
    trustServerCertificate: true,
  },
};
(async () => {
  try {
    await sql.connect(config);
    console.log("✅ Conectado com sucesso ao banco!");
  } catch (err) {
    console.error("❌ Erro na conexão:", err.message);
  }
})();


app.get('/busca-documento', async (req, res) => {
  const { documento } = req.query;

  if (!documento) {
    return res.status(400).json({ message: 'Parâmetro "documento" é obrigatório.' });
  }

  // Divide a string em array e remove espaços em branco
  const documentos = documento.split(',').map(doc => doc.trim());

  try {
    const request = new sql.Request();

    // Adiciona cada documento como um parâmetro nomeado
    const inParams = documentos.map((doc, index) => {
      const paramName = `doc${index}`;
      request.input(paramName, sql.VarChar, doc);
      return `@${paramName}`;
    });

    const query = `
      SELECT
        d.[PK_DOCTOPED],
        d.[TPDOCTO],
        d.[DOCUMENTO],
        d.[DATA],
        d.CONTATO,
        d.[NOME],
        d.[CNPJCPF],
        d.[CIDADE],
        d.[UF],
        d.[IDX_VENDEDOR1],
        f.[NOME] AS NOME_VENDEDOR1,
        d.[TOTALDOCTO],
        d.[SITUACAO],
        d.[TELEFONE],
        CAD.[EMAIL],
        d.[DTPREVISAO],
        d.DTEVENTO,
        d.IDX_ENTIDADE
      FROM [SOUTTOMAYOR].[dbo].[TPADOCTOPED] d
      LEFT JOIN [SOUTTOMAYOR].[dbo].[TPAFUNCIONARIO] f 
        ON d.IDX_VENDEDOR1 = f.PK_FUNCIONARIO
      LEFT JOIN [SOUTTOMAYOR].[dbo].[TPACADASTRO] CAD 
        ON CAD.PK_CADASTRO = d.IDX_ENTIDADE
      WHERE d.DOCUMENTO IN (${inParams.join(',')})
        AND d.TPDOCTO = 'OR'
    `;

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Nenhum documento encontrado.' });
    }

    res.json(result.recordset);
  } catch (err) {
    console.error('Erro ao buscar documentos:', err);
    res.status(500).send(`<p>Erro: ${err.message}</p>`);
  }
});



app.get('/usuarios', async (req, res) => {
  const url = `https://crm.rdstation.com/api/v1/users?token=${accessToken}`;

  try {
    // Realizando a requisição GET para a API do RD Station
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json', // Definindo que a resposta será em JSON
      },
    });

    // Verificando se a resposta foi bem-sucedida
    if (!response.ok) {
      throw new Error('Erro ao buscar usuários');
    }

    // Processando a resposta da API
    const data = await response.json();

    // Retornando os dados recebidos ao cliente
    res.json(data);
  } catch (error) {
    console.error('Erro:', error);
    // Retornando um erro caso algo dê errado
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});



app.get('/leads', async (req, res) => {
  const url = `https://crm.rdstation.com/api/v1/deals?token=${accessToken}`;
  const options = {
    method: 'GET',
    headers: {
      'accept': 'application/json',
    },
  };

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Erro ao buscar dados: ${response.statusText}`);
    }

    const data = await response.json();

    res.json(data);
  } catch (err) {
    res.status(500).send(`<p>Erro: ${err.message}</p>`);
  }
});


app.use(express.json());

// Rota para criar uma negociação
app.post('/criar-negociacao', async (req, res) => {
  const listaNegociacoes = req.body;

  if (!Array.isArray(listaNegociacoes) || listaNegociacoes.length === 0) {
    return res.status(400).json({ error: 'O corpo da requisição deve ser uma lista de negociações.' });
  }

  const negociacaoBase = listaNegociacoes[0];
  const stringDocumentos = listaNegociacoes.map(doc => doc.documento).join(', ');

  let deal_stage_id;
  // if (negociacaoBase.tpDocto === 'OR') {
  //   deal_stage_id = '681d05b48bdc4d0014df017a';
  // } else if (negociacaoBase.tpDocto === 'EC') {
  //   deal_stage_id = '681d05cfabfac8001b21251e';
  // } else {
  //   deal_stage_id = '681d05b48bdc4d0014df017a';
  // }


  console.log(listaNegociacoes)
  const urlUsuario = `https://crm.rdstation.com/api/v1/users/${negociacaoBase.id}?token=6839ba3ee7c1930014ae76ba`;

  let team_id;
  try {
    const response = await fetch(urlUsuario, {
      method: 'GET',
      headers: { accept: 'application/json' }
    });
    const data = await response.json();
    team_id = data;

  } catch (error) {
    console.log(team_id.teams[0].id)
    console.error('Erro ao buscar o team_id:', error);
    return;
  }
  // let deal_stage_id;
  switch (team_id.teams[0].id) {
    case '68233d496e3d40001f69ce70': // Social
      deal_stage_id = '67f98dd7e5c803001ee656d9'; // Funil Evento Social
      break;

    case '6824229dc712fc0028f0ede8': // Corporativo
      deal_stage_id = '681d05b48bdc4d0014df017a'; // Funil Evento Corporativo
      break;

    case '682422a65ec7b6002702afef': // Encomendas
      deal_stage_id = '681d05cfabfac8001b21251e'; // Funil Encomendas
      break;

    default:
      console.error(`Team ID ${team_id} não reconhecido. Verifique os valores.`);
      deal_stage_id = null;
  }
  const url = 'https://crm.rdstation.com/api/v1/deals?token=6839ba3ee7c1930014ae76ba';
  try {

    // Cria a negociação com os dados do primeiro item
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        campaign: { _id: '67f98d5eaf88a40018d1490a' },
        contacts: [
          {
            emails: [{ email: negociacaoBase.email }],
            phones: [{ phone: negociacaoBase.telefone }],
            name: negociacaoBase.contato
          }
        ],
        deal: {
          deal_custom_fields: [
            { custom_field_id: '683de4ca6e4789001885175d', value: stringDocumentos },
            { custom_field_id: '683f2eb15f03510021205571', value: negociacaoBase.dataCadastro },
            { custom_field_id: '6841dfb5475f21001ea82041', value: negociacaoBase.cidade }
          ],
          deal_stage_id: deal_stage_id,
          user_id: negociacaoBase.id,
          name: negociacaoBase.evento,
          prediction_date: negociacaoBase.dataEvento
        },
        deal_source: { _id: negociacaoBase.idFonte },
      })
    });
console.log(negociacaoBase.idFonte)
    if (!response.ok) throw new Error('Erro ao criar a negociação');

    const negotiationData = await response.json();
    const dealId = negotiationData.id;

    // Agora adiciona todos os documentos como produtos à negociação
    const results = [];

    for (const negociacao of listaNegociacoes) {
      const productUrl = `https://crm.rdstation.com/api/v1/deals/${dealId}/deal_products?token=6839ba3ee7c1930014ae76ba`;

      const productOptions = {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          amount: 1,
          price: negociacao.valor,
          product_id: '68368101a578a6001486a29c',
          recurrence: 'spare'
        })
      };

      try {
        const productResponse = await fetch(productUrl, productOptions);
        if (!productResponse.ok) throw new Error('Erro ao adicionar produto');
        const productData = await productResponse.json();

        results.push({
          documento: negociacao.documento,
          status: 'produto adicionado',
          product: productData
        });

      } catch (error) {
        results.push({
          documento: negociacao.documento,
          status: 'erro ao adicionar produto',
          mensagem: error.message
        });
      }
    }

    // Retorna o resultado da negociação e os produtos
    res.json({
      negotiation: negotiationData,
      produtos: results
    });


  }
  catch (error) {
    console.error('Erro geral:', error);
    res.status(500).json({ error: 'Erro ao criar negociação ou adicionar produtos.' });
  }
});


app.put('/atualizar-negociacao', async (req, res) => {
  const _negociacao = req.body;
  console.log(_negociacao)
  if (!Array.isArray(_negociacao) || _negociacao.length === 0) {
    return res.status(400).json({ error: 'O corpo da requisição deve ser uma lista de negociações.' });
  }
  
  const negociacaoBase = _negociacao[0];
  const stringDocumentos = _negociacao.map(doc => doc.documento).join(', ');

  let teamId;
  try {
    const urlUsuario = `https://crm.rdstation.com/api/v1/users/${negociacaoBase.id}?token=6839ba3ee7c1930014ae76ba`;
    const response = await fetch(urlUsuario, { method: 'GET', headers: { accept: 'application/json' } });
    const data = await response.json();
    
    if (!data.teams || data.teams.length === 0) {
      throw new Error('Usuário não possui equipe associada');
    }

    teamId = data.teams[0].id;
  } catch (error) {
    console.error('Erro ao buscar o team_id:', error);
    return res.status(500).json({ error: 'Erro ao buscar o team_id' });
  }

  // Escolhe o funil de acordo com o time
  let deal_stage_id;
  switch (teamId) {
    case '68233d496e3d40001f69ce70': // Social
      deal_stage_id = '67f98dd7e5c803001ee656d9';
      break;
    case '6824229dc712fc0028f0ede8': // Corporativo
      deal_stage_id = '681d05b48bdc4d0014df017a';
      break;
    case '682422a65ec7b6002702afef': // Encomendas
      deal_stage_id = '681d05cfabfac8001b21251e';
      break;
    default:
      console.error(`Team ID ${teamId} não reconhecido.`);
      return res.status(400).json({ error: 'Team ID inválido' });
  }
  const url = `https://crm.rdstation.com/api/v1/deals/${negociacaoBase.deal_id}?token=6839ba3ee7c1930014ae76ba`;
  
  const options = {
    method: 'PUT',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      deal: {
        user_id: negociacaoBase.id,
        deal_custom_fields: [
          { custom_field_id: '683de4ca6e4789001885175d', value: stringDocumentos },
          { custom_field_id: '683f2eb15f03510021205571', value: negociacaoBase.dataCadastro },
          { custom_field_id: '6841dfb5475f21001ea82041', value: negociacaoBase.cidade },
        ],
        prediction_date: negociacaoBase.dataEvento,
      },
      deal_stage_id: deal_stage_id,
    }),
  };
  
  const resultados = [];
  
  try {
    // Atualiza negociação
    const response = await fetch(url, options);
    if (!response.ok) throw new Error('Erro ao atualizar a negociação');
    const negotiationData = await response.json();
    
    const dealId = negotiationData.id || negociacaoBase.deal_id; // Garantir que temos o dealId

    // Adiciona todos os produtos
    for (const negociacao of _negociacao) {
      const productUrl = `https://crm.rdstation.com/api/v1/deals/${dealId}/deal_products?token=6839ba3ee7c1930014ae76ba`;
      const productOptions = {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          amount: 1,
          price: negociacao.valor,
          product_id: '68368101a578a6001486a29c',
          recurrence: 'spare',
        }),
      };

      const productResponse = await fetch(productUrl, productOptions);
      if (!productResponse.ok) throw new Error('Erro ao adicionar o produto');
      const productData = await productResponse.json();

      resultados.push({
        documento: negociacao.documento,
        negotiation: negotiationData,
        product: productData,
      });
    }

    res.json(resultados);

  } catch (error) {
    console.error('Erro geral:', error);
    res.status(500).json({ error: 'Erro ao atualizar negociação ou adicionar produtos' });
  }
});




app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

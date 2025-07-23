const express = require('express')
const app = express()
const port = 4000
const sql = require("mssql");
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

app.use(cors());
app.use(express.json());


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
const db = new sqlite3.Database('etiquetas.db', (err) => {
  if (err) {
    console.error('Erro ao conectar ao SQLite:', err.message);
  } else {
    console.log('✅ Conectado ao banco SQLite');
  }
});


app.get('/healthcheck', (req, res) => {
  res.sendStatus(200);
});

// #Conexão banco de testes
// # conexao = (
// #     "mssql+pyodbc:///?odbc_connect=" + 
// #     "DRIVER={ODBC Driver 17 for SQL Server};" +
// #     "SERVER=192.168.1.137;" +
// #     "DATABASE=SOUTTOMAYOR;" +
// #     "UID=Sa;" +
// #     "PWD=P@ssw0rd2023"
// # )

// const config = {
//   user: "Sa",
//   password: "P@ssw0rd2023",
//   server: "192.168.1.137", // ou '127.0.0.1'
//   database: "SOUTTOMAYOR",
//   options: {
//     encrypt: false, // usar true se estiver acessando remotamente com SSL
//     trustServerCertificate: true, // necessário em ambiente local
//   },
// };

(async () => {
  try {
    await sql.connect(config);
    console.log("✅ Conectado com sucesso ao banco!");
  } catch (err) {
    console.error("❌ Erro na conexão:", err.message);
  }
})();


app.get('/documentos-movimentos', async (req, res) => {
  const { dataInicio, dataFim } = req.query;
  try {
    const resultItens = await sql.query`
      SELECT 
    T1.PK_DOCTOPED,
    T2.PK_MOVTOPED,
    T1.TPDOCTO,
    T1.DOCUMENTO,
    T1.NOME,
    T1.DTPREVISAO,
    T1.CNPJCPF,
    T2.RDX_DOCTOPED AS RDX_DOCTOPED,
    T2.DESCRICAO,
    T2.UNIDADE,
    T2.L_QUANTIDADE,
    SUM(COALESCE(T4.QUANTIDADE, 0)) AS AJUSTE,  -- Somando a quantidade ajustada
	T2.L_QUANTIDADE + SUM(COALESCE(T4.QUANTIDADE, 0)) AS QUANTIDADE_AJUSTADA,
    SUM(COALESCE(T4.QUANTIDADE, 0) * T4.PRECO) AS AJUSTE_PRECO,  -- Multiplicando a quantidade pelo preço
    T2.L_PRECOTOTAL + SUM(COALESCE(T4.QUANTIDADE, 0) * T4.PRECO) AS L_PRECOTOTAL_AJUSTADO,  -- Soma ao L_PRECOTOTAL
    T2.L_PRECOTOTAL,
	T3.CODPRODUTO,
    T3.IDX_NEGOCIO,
    T3.IDX_LINHA
FROM TPADOCTOPED T1
JOIN TPAMOVTOPED T2 ON T1.PK_DOCTOPED = T2.RDX_DOCTOPED
JOIN TPAPRODUTO T3 ON T3.CODPRODUTO = T2.CODPRODUTO
LEFT JOIN TPAAJUSTEPEDITEM T4 ON T4.IDX_MOVTOPED = T2.PK_MOVTOPED
WHERE T1.TPDOCTO IN ('OR', 'EC')
  AND T3.IDX_NEGOCIO IN ('Produtos acabados', 'Desativados')
  AND T1.SITUACAO IN ('Z','B','V')
  AND CONVERT(DATE, T1.DTPREVISAO) BETWEEN ${dataInicio} AND ${dataFim}  -- Ajuste com datas de intervalo
GROUP BY
    T1.PK_DOCTOPED,
    T2.PK_MOVTOPED,
    T1.TPDOCTO,
    T1.DOCUMENTO,
    T1.NOME,
    T1.DTPREVISAO,
    T1.CNPJCPF,
    T2.RDX_DOCTOPED,
    T2.DESCRICAO,
    T2.UNIDADE,
    T2.L_QUANTIDADE,
    T2.L_PRECOTOTAL,
    T3.CODPRODUTO,
    T3.IDX_NEGOCIO,
    T3.IDX_LINHA
ORDER BY T1.PK_DOCTOPED DESC
  `;


    const resultPedidos = await sql.query`
SELECT DISTINCT
  T1.DOCUMENTO,
  T1.NOME,
  T1.CNPJCPF,
  T1.DTPREVISAO,
  T1.TPDOCTO,
  T1.TOTALDOCTO,
  T1.TOTALDOCTO + ISNULL(SUM(T2.TOTALVALOR), 0) AS AJUSTE_TOTAL  -- Somando o TOTALDOCTO ao valor do ajuste, tratando nulos
FROM TPADOCTOPED T1
LEFT JOIN TPAAJUSTEPED T2 ON T2.RDX_DOCTOPED = T1.PK_DOCTOPED
WHERE T1.TPDOCTO IN ('OR', 'EC')
  AND T1.SITUACAO IN ('Z','B','V')
  AND CONVERT(DATE, T1.DTPREVISAO) BETWEEN ${dataInicio} AND ${dataFim}
GROUP BY 
  T1.DOCUMENTO,
  T1.NOME,
  T1.CNPJCPF,
  T1.DTPREVISAO,
  T1.TPDOCTO,
  T1.TOTALDOCTO
ORDER BY T1.DTPREVISAO
`;

    res.json({
      itens: resultItens.recordset,
      pedidos: resultPedidos.recordset
    });
  } catch (err) {
    res.status(500).send(`<p>Erro: ${err.message}</p>`);
  }
});

app.get('/busca-mc', async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const queryDia = await sql.query`
      SELECT D.PK_DOCTOPED, D.TPDOCTO, D.DOCUMENTO, D.NOME, 
             MAX(D.DTEVENTO) AS DTEVENTO, 
             MAX(D.DTPREVISAO) AS DTPREVISAO, 
             OP.HORAPREVISAO, OP.SITUACAO 
      FROM TPAOP AS OP 
      INNER JOIN TPAOPDOCTOPED AS OPDOCTO ON OP.PK_OP = OPDOCTO.RDX_OP
      INNER JOIN TPADOCTOPED AS D ON OPDOCTO.IDX_DOCTOPED = D.PK_DOCTOPED
      WHERE 
        (D.TPDOCTO = 'OR' AND D.SITUACAO IN ('V', 'B') 
        AND CAST(D.DTEVENTO AS DATE) BETWEEN ${startDate} AND ${endDate})
        AND OP.SITUACAO != 'U'
        OR (D.TPDOCTO = 'EC' AND D.SITUACAO IN ('Z', 'B') 
        AND CAST(D.DTPREVISAO AS DATE) BETWEEN ${startDate} AND ${endDate} 
        AND OP.SITUACAO != 'U')
      GROUP BY D.PK_DOCTOPED, D.TPDOCTO, D.DOCUMENTO, D.NOME, 
               D.DTEVENTO, D.DTPREVISAO, OP.HORAPREVISAO, OP.SITUACAO
      ORDER BY OP.HORAPREVISAO`;

    const queryHoras = await sql.query`
      SELECT D.PK_DOCTOPED, D.DOCUMENTO, D.NOME, D.DTEVENTO, 
             D.DTPREVISAO AS DATA_FINAL, D.HORAPREVISAO, 
             OP.HORAPREVISAO, OP.SITUACAO 
      FROM TPAOP AS OP 
      INNER JOIN TPAOPDOCTOPED AS OPDOCTO ON OP.PK_OP = OPDOCTO.RDX_OP
      INNER JOIN TPADOCTOPED AS D ON OPDOCTO.IDX_DOCTOPED = D.PK_DOCTOPED
      WHERE 
        (D.TPDOCTO = 'OR' AND CAST(D.DTEVENTO AS DATE) BETWEEN ${startDate} AND ${endDate})
        OR (D.TPDOCTO = 'EC' AND CAST(D.DTPREVISAO AS DATE) BETWEEN ${startDate} AND ${endDate})
        AND OP.SITUACAO != 'U'
      ORDER BY OP.HORAPREVISAO`;

    const queryProdutos = await sql.query`
      SELECT MOVTO.DESCRICAO, DOC.TPDOCTO, DOC.DOCUMENTO, OPPROD.QUANTIDADE, 
             OP.HORAPREVISAO, OP.DTPREVISAO, OPPROD.SITUACAO, PROD.IDX_LINHA
      FROM TPAOPPROD AS OPPROD
      INNER JOIN TPAOP AS OP ON OPPROD.RDX_OP = OP.PK_OP
      INNER JOIN TPAMOVTOPED AS MOVTO ON OPPROD.IDX_MOVTOPED = MOVTO.PK_MOVTOPED
      INNER JOIN TPADOCTOPED AS DOC ON MOVTO.RDX_DOCTOPED = DOC.PK_DOCTOPED
      INNER JOIN TPAPRODUTO AS PROD ON MOVTO.CODPRODUTO = PROD.CODPRODUTO
      WHERE 
        (DOC.TPDOCTO = 'OR' OR DOC.TPDOCTO = 'EC' OR DOC.TPDOCTO = 'PP')
        AND CAST(OP.DTPREVISAO AS DATE) BETWEEN ${startDate} AND ${endDate}
        AND OPPROD.SITUACAO != 'U'
      ORDER BY OP.DTPREVISAO`;

    res.json({
      day: queryDia.recordset,
      hours: queryHoras.recordset,
      products: queryProdutos.recordset
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar dados');
  }
});

app.get('/produtos-pendentes', async (req, res) => {
    const { startDate, endDate } = req.query;

 
  try {
    // Consulta SQL com JOINs adicionais na tabela TPAAJUSTEPED e TPAAJUSTEPEDITEM
    const products = await sql.query(`SELECT
    MOVTO.DESCRICAO,
    DOC.TPDOCTO,
    DOC.DOCUMENTO,
    OPPROD.QUANTIDADE,
    OPPROD.UNIDADE,
    OP.HORAPREVISAO,
    OP.DTPREVISAO, 
    OPPROD.SITUACAO, 
    PROD.IDX_LINHA,
    CASE 
        WHEN T4.SITUACAO = 'V' THEN T5.QUANTIDADE
        ELSE NULL
    END AS QUANTIDADE,
    T5.QTORIGINAL
FROM TPAOPPROD AS OPPROD
    INNER JOIN TPAOP AS OP ON OPPROD.RDX_OP = OP.PK_OP
    INNER JOIN TPAMOVTOPED AS MOVTO ON OPPROD.IDX_MOVTOPED = MOVTO.PK_MOVTOPED
    INNER JOIN TPADOCTOPED AS DOC ON MOVTO.RDX_DOCTOPED = DOC.PK_DOCTOPED
    INNER JOIN TPAPRODUTO AS PROD ON MOVTO.CODPRODUTO = PROD.CODPRODUTO
    LEFT JOIN TPAAJUSTEPEDITEM T5 ON T5.IDX_MOVTOPED = MOVTO.PK_MOVTOPED
    LEFT JOIN TPAAJUSTEPED AS T4 ON T5.RDX_AJUSTEPED = T4.PK_AJUSTEPED
WHERE 
    DOC.TPDOCTO IN ('OR', 'EC', 'PP')
    AND CAST(OP.DTPREVISAO AS DATE) BETWEEN '${startDate}' AND '${endDate}'
    AND OPPROD.SITUACAO != 'U'
ORDER BY 
    OP.DTPREVISAO DESC

    `);

    res.json(products.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send(`<p>Erro: ${err.message}</p>`);
  }
});


app.get('/produtos-baixados', async (req, res) => {
    const { startDate, endDate } = req.query;

 
  try {
    // Consulta SQL com JOINs adicionais na tabela TPAAJUSTEPED e TPAAJUSTEPEDITEM
    const products = await sql.query(`
      -- Subquery: peso unitário da composição por produto
WITH PESO_UNITARIO AS (
    SELECT 
        COMP.RDX_PRODUTO AS PK_PRODUTO,
        SUM(
            CASE 
                WHEN UPPER(COMP.UN) = 'KG' THEN COMP.QUANTIDADE * 1000
                WHEN UPPER(COMP.UN) = 'LT' THEN COMP.QUANTIDADE * 1000
                WHEN UPPER(COMP.UN) IN ('GR', 'ML') THEN COMP.QUANTIDADE
                ELSE 0
            END
        ) AS PESO_UNITARIO
    FROM TPAPRODCOMPOSICAO AS COMP
    GROUP BY COMP.RDX_PRODUTO
)

SELECT 
    P.CODPRODUTO, 
    M.DESCRICAO, 
    P.PESOKG, 
    M.UNIDADE, 
    P.IDX_NEGOCIO, 
    P.IDX_LINHA,  
    SUM(L_QUANTIDADE) AS QTD_VENDIDA, 
    SUM(L_PRECOTOTAL) AS VALOR_TOTAL,
    PU.PESO_UNITARIO
FROM TPAMOVTOPED AS M
    INNER JOIN TPADOCTOPED AS D ON D.PK_DOCTOPED = M.RDX_DOCTOPED
    INNER JOIN TPAPRODUTO AS P ON P.PK_PRODUTO = M.IDX_PRODUTO
    INNER JOIN TPAOPPROD AS OP ON OP.IDX_MOVTOPED = M.PK_MOVTOPED
    LEFT JOIN PESO_UNITARIO AS PU ON PU.PK_PRODUTO = P.PK_PRODUTO
WHERE 
    D.TPDOCTO IN ('OR', 'EC')
    AND P.IDX_NEGOCIO IN ('Produtos acabados', 'Desativados')
    AND D.SITUACAO IN ('Z', 'B', 'V')
    AND OP.DTEXECUCAO BETWEEN '${startDate}' AND '${endDate}'
    AND P.CODPRODUTO <> '006'
GROUP BY 
    P.CODPRODUTO, 
    P.PESOKG,
    M.DESCRICAO, 
    M.UNIDADE, 
    P.IDX_NEGOCIO, 
    P.IDX_LINHA,
    PU.PESO_UNITARIO
  order by DESCRICAO
    `);

    res.json(products.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send(`<p>Erro: ${err.message}</p>`);
  }
});

app.get('/api/produtos', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query("select DESCRICAO, VALIDADE, TPVALIDADE from TPAPRODUTO where IDX_NEGOCIO = 'Produtos acabados' ORDER BY DESCRICAO");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/nota', async (req, res) => {
  const { documentos } = req.query;

  try {
    // Verifica se documentos está presente e transforma em array
    if (!documentos) {
      return res.status(400).json({ error: 'Parâmetro "documentos" é obrigatório' });
    }

    const docList = documentos.split(',').map(id => parseInt(id.trim())).filter(Boolean);

    if (docList.length === 0) {
      return res.status(400).json({ error: 'Lista de documentos inválida' });
    }

    // Gera placeholders e parâmetros
    const placeholders = docList.map((_, i) => `@doc${i}`).join(', ');
    const inputParams = docList.map((val, i) => ({ name: `doc${i}`, type: sql.Int, value: val }));

    // Monta query com placeholders
    let query = `
        -- Parte 1: Detalhes por produto (acabados/desativados)
SELECT 
    ci.CODPRODUTO,
    ci.DESCRICAO,
    ci.UNIDADE,
    SUM(ci.L_QUANTIDADE) AS TOTAL_QUANTIDADE,
    SUM(ci.L_PRECOTOTAL) AS TOTAL_PRECO,
    p.IDX_NEGOCIO,
    NULL AS TOTALDOCTO,
    0 AS ORDENADOR
FROM [SOUTTOMAYOR].[dbo].[TPACONTRATOITEM] ci
JOIN TPADOCTOPED dc ON dc.IDX_CONTRATOMOV = ci.RDX_CONTRATOMOV
JOIN TPAPRODUTO p ON p.PK_PRODUTO = ci.IDX_PRODUTO
WHERE dc.PK_DOCTOPED IN (${placeholders})
  AND p.IDX_NEGOCIO IN ('Produtos acabados','Desativados')
GROUP BY 
    ci.CODPRODUTO, ci.DESCRICAO, ci.UNIDADE, p.IDX_NEGOCIO

UNION ALL

-- Parte 2: Totais por negócio (exceto acabados/desativados)
SELECT 
    NULL AS CODPRODUTO,
    NULL AS DESCRICAO,
    NULL AS UNIDADE,
    SUM(ci.L_QUANTIDADE) AS TOTAL_QUANTIDADE,
    SUM(ci.L_PRECOTOTAL) AS TOTAL_PRECO,
    p.IDX_NEGOCIO,
    NULL AS TOTALDOCTO,
    0 AS ORDENADOR
FROM [SOUTTOMAYOR].[dbo].[TPACONTRATOITEM] ci
JOIN TPADOCTOPED dc ON dc.IDX_CONTRATOMOV = ci.RDX_CONTRATOMOV
JOIN TPAPRODUTO p ON p.PK_PRODUTO = ci.IDX_PRODUTO
WHERE dc.PK_DOCTOPED IN (${placeholders})
  AND p.IDX_NEGOCIO NOT IN ('Produtos acabados','Desativados')
GROUP BY 
    p.IDX_NEGOCIO

UNION ALL

-- Parte 3: Total Geral com totaldocto somado 1x por PK_DOCTOPED
SELECT
    NULL AS CODPRODUTO,
    'TOTAL GERAL' AS DESCRICAO,
    NULL AS UNIDADE,
    SUM(ci.L_QUANTIDADE) AS TOTAL_QUANTIDADE,
    SUM(ci.L_PRECOTOTAL) AS TOTAL_PRECO,
    NULL AS IDX_NEGOCIO,
    (
        SELECT SUM(DISTINCT D.TOTALDOCTO)
        FROM [SOUTTOMAYOR].[dbo].[TPADOCTOPED] D
        WHERE D.PK_DOCTOPED IN (${placeholders})
    ) AS TOTALDOCTO,
    1 AS ORDENADOR
FROM [SOUTTOMAYOR].[dbo].[TPACONTRATOITEM] ci
JOIN TPADOCTOPED dc ON dc.IDX_CONTRATOMOV = ci.RDX_CONTRATOMOV
WHERE dc.PK_DOCTOPED IN (${placeholders})

ORDER BY 
    ORDENADOR,
    DESCRICAO;

    `;

    // Executa com parâmetros seguros
    const request = new sql.Request();
    inputParams.forEach(param => {
      request.input(param.name, param.type, param.value);
    });

    const products = await request.query(query);
    res.json(products.recordset);

  } catch (err) {
    console.error(err);
    res.status(500).send(`<p>Erro: ${err.message}</p>`);
  }
});

app.get('/buscar-doc', async (req, res) => {
  const { documento } = req.query;

  try {
    if (!documento) {
      return res.status(400).json({ error: 'Parâmetro "documento" é obrigatório' });
    }

    // Cria e configura a consulta com parâmetros
    const query = `
      SELECT
         [PK_DOCTOPED],
         [DOCUMENTO],
         [DTEVENTO],
         [NOME],
         [CNPJCPF],
         [CIDADE],
         [UF],
         [IDX_MOEDA],
         [TOTALDOCTO]
      FROM [SOUTTOMAYOR].[dbo].[TPADOCTOPED]
      WHERE TPDOCTO = 'OR'
        AND SITUACAO IN ('V','B')
        AND DOCUMENTO = @documento
    `;

    const request = new sql.Request();
    request.input('documento', sql.VarChar, documento);  // Use o tipo apropriado conforme o banco

    const result = await request.query(query);
    res.json(result.recordset);

  } catch (err) {
    console.error('Erro ao buscar documento:', err);
    res.status(500).send(`<p>Erro interno: ${err.message}</p>`);
  }
});

app.get('/etiquetas', (req, res) => {
  db.all('SELECT * FROM etiquetas', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ etiquetas: rows });
  });
});

// Rota GET: Buscar um produto específico por ID
app.get('/etiquetas/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM etiquetas WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Produto não encontrado' });
      return;
    }
    res.json(row);
  });
});

// Rota POST: Criar um novo produto
app.post('/etiquetas', (req, res) => {
  const {
    produto, porcao, caseira, energia100g, energiag, energiaVD, carb100g, carbg, carbVD,
    acucar100g, acucarg, acucarVD, acucarad100g, acucaradg, acucaradVD,
    proteina100g, proteinag, proteinaVD, gorduraTotal100g, gorduraTotalg,
    gorduraTotalVD, gorduraSaturada100g, gorduraSaturadag, gorduraSaturadaVD,
    gorduraTrans100g, gorduraTransg, gorduraTransVD, fibra100g, fibrag,
    fibraVD, sodio100g, sodiog, sodioVD, ingredientes, glutem, armazenamento,
    quantidade, valorQuant, valorTotal, validade, alergenicos,
    valoresReferencia, lactose, transgenico, selo_alto_em
  } = req.body;

  // Remover a coluna 'fabricacao' da consulta SQL de inserção
  const stmt = db.prepare(`
    INSERT INTO etiquetas (
      produto, porcao, caseira, energia100g, energiag, energiaVD, carb100g, carbg, carbVD,
      acucar100g, acucarg, acucarVD, acucarad100g, acucaradg, acucaradVD, proteina100g,
      proteinag, proteinaVD, gorduraTotal100g, gorduraTotalg, gorduraTotalVD,
      gorduraSaturada100g, gorduraSaturadag, gorduraSaturadaVD, gorduraTrans100g,
      gorduraTransg, gorduraTransVD, fibra100g, fibrag, fibraVD, sodio100g, sodiog,
      sodioVD, ingredientes, glutem, armazenamento, quantidade, valorQuant, valorTotal,
      validade, alergenicos, valoresReferencia, lactose, transgenico, selo_alto_em
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  stmt.run(
    produto, porcao, caseira, energia100g, energiag, energiaVD, carb100g, carbg, carbVD,
    acucar100g, acucarg, acucarVD, acucarad100g, acucaradg, acucaradVD, proteina100g,
    proteinag, proteinaVD, gorduraTotal100g, gorduraTotalg, gorduraTotalVD,
    gorduraSaturada100g, gorduraSaturadag, gorduraSaturadaVD, gorduraTrans100g,
    gorduraTransg, gorduraTransVD, fibra100g, fibrag, fibraVD, sodio100g, sodiog,
    sodioVD, ingredientes, glutem, armazenamento, quantidade, valorQuant, valorTotal,
    validade,alergenicos, valoresReferencia, lactose, transgenico, selo_alto_em
  );

  stmt.finalize();

  res.status(201).json({ message: 'Produto criado com sucesso!' });
});



// Rota PUT: Atualizar um produto específico por ID
app.put('/etiquetas/:id', (req, res) => {
  const { id } = req.params;
  const {
    produto, porcao, caseira, energia100g, energiag, energiaVD,
    carb100g, carbg, carbVD, acucar100g, acucarg, acucarVD,
    acucarad100g, acucaradg, acucaradVD, proteina100g, proteinag,
    proteinaVD, gorduraTotal100g, gorduraTotalg, gorduraTotalVD,
    gorduraSaturada100g, gorduraSaturadag, gorduraSaturadaVD,
    gorduraTrans100g, gorduraTransg, gorduraTransVD, fibra100g,
    fibrag, fibraVD, sodio100g, sodiog, sodioVD, ingredientes,
    glutem, armazenamento, quantidade, valorQuant, valorTotal,
    validade, alergenicos, valoresReferencia, lactose, transgenico, selo_alto_em
  } = req.body;

  const query = `UPDATE etiquetas SET 
    produto = ?, porcao = ?, caseira = ?, energia100g = ?, energiag = ?, energiaVD = ?,
    carb100g = ?, carbg = ?, carbVD = ?, acucar100g = ?, acucarg = ?, acucarVD = ?,
    acucarad100g = ?, acucaradg = ?, acucaradVD = ?, proteina100g = ?, proteinag = ?,
    proteinaVD = ?, gorduraTotal100g = ?, gorduraTotalg = ?, gorduraTotalVD = ?,
    gorduraSaturada100g = ?, gorduraSaturadag = ?, gorduraSaturadaVD = ?,
    gorduraTrans100g = ?, gorduraTransg = ?, gorduraTransVD = ?, fibra100g = ?,
    fibrag = ?, fibraVD = ?, sodio100g = ?, sodiog = ?, sodioVD = ?, ingredientes = ?,
    glutem = ?, armazenamento = ?, quantidade = ?, valorQuant = ?, valorTotal = ?,
    validade = ?, alergenicos = ?, valoresReferencia = ?, lactose = ?, transgenico = ?, selo_alto_em = ?
  WHERE id = ?`;

  db.run(query, [
    produto, porcao, caseira, energia100g, energiag, energiaVD,
    carb100g, carbg, carbVD, acucar100g, acucarg, acucarVD,
    acucarad100g, acucaradg, acucaradVD, proteina100g, proteinag,
    proteinaVD, gorduraTotal100g, gorduraTotalg, gorduraTotalVD,
    gorduraSaturada100g, gorduraSaturadag, gorduraSaturadaVD,
    gorduraTrans100g, gorduraTransg, gorduraTransVD, fibra100g,
    fibrag, fibraVD, sodio100g, sodiog, sodioVD, ingredientes,
    glutem, armazenamento, quantidade, valorQuant, valorTotal, validade, alergenicos, valoresReferencia, lactose, transgenico, selo_alto_em, id
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(200).json({ updatedID: id });
  });
});

// Rota DELETE: Excluir um produto por ID
app.delete('/etiquetas/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM etiquetas WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Produto não encontrado' });
      return;
    }
    res.status(200).json({ deletedID: id });
  });
});

app.get('/planejamento-prod', async (req, res) => {
  const { startDate, endDate } = req.query;


  try {
    // Consulta SQL com JOINs adicionais na tabela TPAAJUSTEPED e TPAAJUSTEPEDITEM
    const products = await sql.query(`SELECT 
    OPPROD.IDX_PRODUTO,
    P.DESCRICAO, 
    SUM(OPPROD.QUANTIDADE) AS TOTAL_QUANTIDADE,
    P.PESOKG,
	  OPPROD.UNIDADE,
    CAST(OP.DTPREVISAO AS DATE) AS PREVISAO_DATA,
    P.IDX_LINHA
FROM TPAOPPROD AS OPPROD
INNER JOIN TPAOP AS OP ON OPPROD.RDX_OP = OP.PK_OP
INNER JOIN TPAPRODUTO AS P ON P.PK_PRODUTO = OPPROD.IDX_PRODUTO
WHERE CAST(OP.DTPREVISAO AS DATE) BETWEEN '${startDate}' AND '${endDate}'
GROUP BY
    OPPROD.IDX_PRODUTO,
    P.DESCRICAO,
    P.PESOKG,
	  OPPROD.UNIDADE,
    CAST(OP.DTPREVISAO AS DATE), 
    P.IDX_LINHA
ORDER BY 
    P.DESCRICAO, 
    CAST(OP.DTPREVISAO AS DATE); -- Agora, DTPREVISAO também está no GROUP BY
    `);

    res.json(products.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send(`<p>Erro: ${err.message}</p>`);
  }
});



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
// http://localhost:3000/users?limit=3&o=desc
// SELECT * FROM NewTable where data between 20240201 and 20250301
//join

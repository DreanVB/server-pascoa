const express = require('express')
const app = express()
const port = 4000
const sql = require("mssql");
const cors = require('cors');
app.use(cors());
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
FROM TPADOCTOPED T1
JOIN TPAMOVTOPED T2 ON T1.PK_DOCTOPED = T2.RDX_DOCTOPED
JOIN TPAPRODUTO T3 ON T3.CODPRODUTO = T2.CODPRODUTO
WHERE T1.TPDOCTO IN ('OR', 'EC')
  AND T3.IDX_NEGOCIO IN ('Produtos acabados', 'Desativados')
  And T1.SITUACAO IN ('Z','B','V')
  AND CONVERT(DATE, T1.DTPREVISAO) BETWEEN ${dataInicio} AND ${dataFim}  -- Ajuste com datas de intervalo
  ORDER BY T1.PK_DOCTOPED DESC
  `;

  
  const resultPedidos = await sql.query`SELECT DISTINCT
  T1.DOCUMENTO,
  T1.NOME,
  T1.CNPJCPF,
  T1.DTPREVISAO,
  T1.TPDOCTO
FROM TPADOCTOPED T1
JOIN TPAMOVTOPED T2 ON T1.PK_DOCTOPED = T2.RDX_DOCTOPED
JOIN TPAPRODUTO T3 ON T3.CODPRODUTO = T2.CODPRODUTO
WHERE T1.TPDOCTO IN ('OR', 'EC')
  AND T3.IDX_NEGOCIO IN ('Produtos acabados', 'Desativados')
  AND T1.SITUACAO IN ('Z','B','V')
  AND CONVERT(DATE, T1.DTPREVISAO) BETWEEN ${dataInicio} AND ${dataFim}
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





  



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
// http://localhost:3000/users?limit=3&o=desc
// SELECT * FROM NewTable where data between 20240201 and 20250301
//join
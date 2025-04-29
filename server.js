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
    const result = await sql.query`
      SELECT 
    T1.PK_DOCTOPED,
    T1.TPDOCTO,
    T1.DOCUMENTO,
    T1.NOME,
    T1.DTPREVISAO,
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
    res.json(result.recordset);
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





  



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
// http://localhost:3000/users?limit=3&o=desc
// SELECT * FROM NewTable where data between 20240201 and 20250301
//join
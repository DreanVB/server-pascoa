FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Instala ferramentas de build e pacotes necessários para sqlite3
RUN apk add --no-cache python3 make g++ sqlite sqlite-dev

# Copia package.json e instala dependências
COPY package*.json ./
RUN npm install

# Copia o restante da aplicação
COPY server.js .  # Ou '.' se tiver mais arquivos

# Expor a porta usada pela aplicação
EXPOSE 4000

# Comando para iniciar a aplicação
CMD ["node", "server.js"]

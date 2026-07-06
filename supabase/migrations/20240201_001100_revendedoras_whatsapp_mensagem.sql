-- Mensagem customizada que a cliente vai mandar pra revendedora
-- quando clicar no botão WhatsApp da loja.
-- Default (NULL) = mensagem padrão "Olá Maria! Vi sua loja 💎".
-- Suporta placeholder {nome} que vira o primeiro nome da revendedora.
-- Idempotente.
alter table revendedoras
  add column if not exists whatsapp_mensagem text;

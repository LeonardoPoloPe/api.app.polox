# 📅 Swagger Schedule - Exemplos de Uso

## ✅ Atualização Realizada

O Swagger foi atualizado com **7 exemplos completos** para criação de eventos.

## 🎯 Campos Corretos do Schema

### Campos Obrigatórios:
- `title` (string, 2-255 caracteres)
- `start_datetime` (date-time ISO 8601)
- `end_datetime` (date-time ISO 8601, deve ser maior que start_datetime)

### Campos Opcionais:
- `description` (string, até 1000 caracteres)
- `is_all_day` (boolean, default: false)
- `event_type` (enum: meeting, call, task, reminder, event, appointment, default: meeting)
- `status` (enum: scheduled, confirmed, in_progress, completed, cancelled, no_show, default: scheduled)
- `event_location` (string, até 255 caracteres)
- `meeting_link` (URI válida)
- `contato_id` (integer, ID da tabela contacts)
- `timezone` (string, default: America/Sao_Paulo)
- `reminder_minutes` (integer >= 0, default: 15, 0 = sem lembrete)
- `is_recurring` (boolean, default: false)
- `recurrence_pattern` (object JSON com frequency, until, interval)

## 📝 Exemplos Disponíveis no Swagger

### 1. **Reunião Simples**
Exemplo básico com campos obrigatórios:
```json
{
  "title": "Reunião com Cliente",
  "description": "Discussão sobre o projeto Q4 2025",
  "start_datetime": "2025-11-05T14:00:00Z",
  "end_datetime": "2025-11-05T15:00:00Z",
  "event_type": "meeting",
  "contato_id": 16
}
```

### 2. **Reunião Virtual Completa**
Com link de reunião e lembretes:
```json
{
  "title": "Daily Standup - Time Dev",
  "description": "Reunião diária da equipe de desenvolvimento",
  "start_datetime": "2025-11-05T09:00:00Z",
  "end_datetime": "2025-11-05T09:30:00Z",
  "is_all_day": false,
  "event_type": "meeting",
  "status": "scheduled",
  "event_location": "Online",
  "meeting_link": "https://meet.google.com/abc-defg-hij",
  "timezone": "America/Sao_Paulo",
  "reminder_minutes": 15
}
```

### 3. **Ligação Telefônica**
Evento tipo call:
```json
{
  "title": "Ligação - Follow up Proposta",
  "description": "Ligar para cliente sobre proposta comercial",
  "start_datetime": "2025-11-06T10:00:00Z",
  "end_datetime": "2025-11-06T10:30:00Z",
  "event_type": "call",
  "status": "scheduled",
  "contato_id": 16,
  "reminder_minutes": 30
}
```

### 4. **Tarefa/To-do**
Evento tipo task:
```json
{
  "title": "Revisar contrato",
  "description": "Revisar e aprovar contrato do fornecedor XYZ",
  "start_datetime": "2025-11-07T08:00:00Z",
  "end_datetime": "2025-11-07T12:00:00Z",
  "event_type": "task",
  "status": "scheduled",
  "reminder_minutes": 60
}
```

### 5. **Evento Dia Inteiro**
Com `is_all_day: true`:
```json
{
  "title": "Conferência Tech Summit 2025",
  "description": "Participação na conferência anual de tecnologia",
  "start_datetime": "2025-11-10T00:00:00Z",
  "end_datetime": "2025-11-10T23:59:59Z",
  "is_all_day": true,
  "event_type": "event",
  "event_location": "Centro de Convenções SP",
  "reminder_minutes": 1440
}
```

### 6. **Evento Recorrente**
Com padrão de recorrência:
```json
{
  "title": "Reunião Semanal - Planejamento",
  "description": "Reunião de planejamento toda segunda-feira",
  "start_datetime": "2025-11-11T09:00:00Z",
  "end_datetime": "2025-11-11T10:00:00Z",
  "event_type": "meeting",
  "status": "scheduled",
  "meeting_link": "https://zoom.us/j/123456789",
  "is_recurring": true,
  "recurrence_pattern": {
    "frequency": "weekly",
    "until": "2025-12-31",
    "interval": 1
  },
  "reminder_minutes": 15
}
```

### 7. **Evento Sem Lembrete**
Com `reminder_minutes: 0`:
```json
{
  "title": "Almoço Executivo",
  "start_datetime": "2025-11-08T12:00:00Z",
  "end_datetime": "2025-11-08T13:30:00Z",
  "event_type": "appointment",
  "event_location": "Restaurante Braz - Faria Lima",
  "reminder_minutes": 0
}
```

## 🔄 Como Usar no Swagger UI

1. Acesse: `http://localhost:3000/api-docs`
2. Vá até: **POST /api/v1/schedule/events**
3. Clique em **"Try it out"**
4. No campo **Request body**, você verá um dropdown **"Example"**
5. Selecione um dos 7 exemplos disponíveis:
   - `reuniao_simples`
   - `reuniao_virtual`
   - `ligacao`
   - `tarefa`
   - `evento_dia_inteiro`
   - `evento_recorrente`
   - `sem_lembrete`
6. O JSON será preenchido automaticamente!
7. Clique em **"Execute"** para testar

## ⚠️ Erros Comuns Corrigidos

### ❌ Campos REMOVIDOS (não existem mais):
- ~~`all_day`~~ → Use **`is_all_day`**
- ~~`priority`~~ → Campo não existe no schema atual
- ~~`location`~~ → Use **`event_location`**
- ~~`virtual_meeting_url`~~ → Use **`meeting_link`**
- ~~`attendees`~~ → Campo não existe no schema atual
- ~~`recurring`~~ → Use **`is_recurring`**
- ~~`recurring_frequency`~~ → Use dentro de **`recurrence_pattern.frequency`**
- ~~`recurring_until`~~ → Use dentro de **`recurrence_pattern.until`**
- ~~`visibility`~~ → Campo não existe no schema atual
- ~~`metadata`~~ → Campo não existe no schema atual

## 🚀 Reiniciar Servidor

Para ver as mudanças no Swagger:

```bash
# Parar o servidor (Ctrl+C)
# Depois iniciar novamente:
npm run dev
# ou
pnpm dev
```

Acesse: http://localhost:3000/api-docs

## 📚 Documentação Atualizada

- ✅ Schema correto com todos os campos válidos
- ✅ 7 exemplos práticos prontos para uso
- ✅ Descrições detalhadas de cada campo
- ✅ Valores padrão documentados
- ✅ Respostas de erro documentadas

---

**Data da Atualização:** 05/11/2025  
**Arquivo Atualizado:** `src/routes/schedule.js`

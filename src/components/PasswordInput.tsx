'use client'
import { useState } from 'react'

// Input de senha com toggle 👁 / 🙈 e hint visível embaixo.
// Usado em login, registro, redefinir-senha e na landing — todos os
// formulários onde a usuária precisa digitar uma senha (entrar ou criar).
//
// className: respeita o estilo do formulário consumidor (input-padrão
// ou f-input). Default = 'input-padrao'.
type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  hint?: string
  autoComplete?: string
  name?: string
}

export default function PasswordInput({
  value,
  onChange,
  placeholder,
  required = false,
  className = 'input-padrao',
  hint,
  autoComplete,
  name,
}: Props) {
  const [show, setShow] = useState(false)
  return (
    <>
      <div style={{ position: 'relative' }}>
        <input
          className={className}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          name={name}
          // Belt-and-suspenders: type toggle + WebkitTextSecurity.
          // Alguns browsers (iOS Safari c/ autofill, certos Androids)
          // ignoram a troca de type quando o autocomplete tá ativo.
          // Forçar -webkit-text-security: none garante que mostra.
          style={{
            paddingRight: 90,
            WebkitTextSecurity: show ? 'none' : 'disc',
          } as React.CSSProperties}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          title={show ? 'Ocultar senha' : 'Mostrar senha'}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#F5F5F5',
            border: '1px solid #DDD',
            borderRadius: 6,
            cursor: 'pointer',
            color: '#1A1A1A',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            padding: '8px 10px',
            lineHeight: 1,
            minHeight: 34,
            minWidth: 76,
            textTransform: 'uppercase',
          }}
        >
          {show ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {hint && (
        <div
          style={{
            fontSize: 11,
            color: '#777',
            marginTop: 6,
            lineHeight: 1.5,
            fontStyle: 'italic',
          }}
        >
          {hint}
        </div>
      )}
    </>
  )
}

// Hint padrão p/ formulários de criar/redefinir senha (use no PRIMEIRO
// campo só; o segundo é confirmação e não precisa repetir).
export const HINT_SENHA =
  'Mínimo 6 caracteres. Pode ser qualquer coisa que tu lembre.'

# Puesta en marcha (una sola vez)

Tiempo: unos 60-90 minutos entre los dos. Los pasos 1-6 los hace **Miguel** (son de administración). El paso 7 lo hace **Valentina** en su ordenador.

> Regla de oro: las contraseñas y claves van a **Bitwarden** y a `.env.local`. Nunca al chat, a un correo o a GitHub.

---

## 1. Base de datos: Supabase (Miguel)

Se crea un proyecto **nuevo en la cuenta de Mavie**, no en la de AppSi, y separado del de Harvey.

1. Entra en https://supabase.com/dashboard → **New project**.
   - Nombre: `valentina-crm`
   - Región: **Europe (Frankfurt o Paris)**: los datos se quedan en la UE (RGPD).
   - Contraseña de la base de datos: la genera Supabase. Guárdala en Bitwarden; casi nunca hará falta.
   - Plan: **Free**.
2. Cuando esté listo: **SQL Editor** → **New query**. Pega todo el contenido de `supabase/migrations/20261104000000_crm_valentina.sql` y pulsa **Run**. Tiene que terminar en *Success*.
3. **Authentication → Sign In / Providers → Email**: desactiva **Allow new users to sign up**. Así solo entra quien demos de alta nosotros.
4. **Authentication → URL Configuration**:
   - Site URL: la dirección del CRM (paso 4, por ejemplo `https://valentina-crm.pages.dev`).
   - Redirect URLs: añade esa misma dirección. Sirve para el correo de "He olvidado la contraseña".

## 2. Usuarios y roles (Miguel)

En **Authentication → Users → Add user → Create new user** crea estos tres. Marca **Auto Confirm User** y genera las contraseñas con Bitwarden:

| Usuario | Para qué | Rol |
|---|---|---|
| Tu correo | Tú (administrador: aprueba demos, puede deshacer bajas) | `admin` |
| Correo de Valentina | Ella (busca, diseña, llama, escribe) | `comercial` |
| `agente@...` (un correo tuyo con alias, por ejemplo `tucorreo+agente@gmail.com`) | La cuenta de Antigravity, con menos permisos | `agente` |

Después, en **SQL Editor**, dales su rol (cambia los correos):

```sql
select public.alta_equipo('miguel@...', 'Miguel', 'admin');
select public.alta_equipo('valentina@...', 'Valentina', 'comercial');
select public.alta_equipo('tucorreo+agente@gmail.com', 'Agente Antigravity', 'agente');
```

- **La contraseña de Valentina:** que entre en el CRM y pulse "He olvidado la contraseña" para ponerse una suya.
- **La contraseña del agente:** pásasela por Bitwarden (función *Send*) para su `.env.local`.

> Si algún día Valentina tiene que aprobar demos, se le cambia el rol: `select public.alta_equipo('valentina@...', 'Valentina', 'admin');`

## 3. Claves públicas del proyecto (Miguel)

**Project Settings → API Keys**:

- **Project URL** (`https://xxxx.supabase.co`)
- **Publishable key** (`sb_publishable_...`). Si tu proyecto muestra las claves antiguas, es la **anon public**.

Son **públicas a propósito**: lo que protege los datos son las reglas RLS del paso 1. La **secret key** (`sb_secret_...` o `service_role`) **no se usa en ningún sitio** de este proyecto.

Rellena `crm/config.js` con esos dos valores y súbelo a GitHub en un Pull Request.

## 4. Publicar el CRM y las demos: Cloudflare Pages (Miguel)

Se crean **dos proyectos** desde el mismo repositorio. Así el CRM y las demos viven en direcciones distintas y una demo nunca puede tocar la sesión del CRM.

En https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**. Si te propone Workers, elige la pestaña Pages. Autoriza GitHub y elige `valentina-call-dashboard`.

| | Proyecto 1: CRM | Proyecto 2: demos |
|---|---|---|
| Nombre del proyecto | `valentina-crm` | `mavie-demos` |
| Rama de producción | `main` | `main` |
| Framework preset | None | None |
| Build command | `npm ci && npm run build:crm` | *(vacío)* |
| Build output directory | `crm` | `demos` |
| Build watch paths (opcional) | `crm/*`, `package*.json` | `demos/*` |

- Las direcciones quedarán `https://valentina-crm.pages.dev` y `https://mavie-demos.pages.dev`.
- Si `mavie-demos` está cogido, usa otro nombre y cámbialo en dos sitios: `crm/js/ajustes.js` (`demos.urlBase`) y `crm/_headers` (`connect-src`).
- Con dominio propio (por ejemplo `demos.mavieiasolutions.com`), se añade en el proyecto → **Custom domains**, y se cambian esos mismos dos sitios.
- Las cabeceras de seguridad (`crm/_headers`, `demos/_headers`) las aplica Cloudflare solo.
- Cada Pull Request tendrá su **vista previa** con dirección propia. Cloudflare la comenta en el Pull Request.

> **Bloqueos de LaLiga:** en días de partido algunos operadores bloquean IPs de Cloudflare (y a veces de GitHub o Vercel). Ningún hosting gratuito se libra.
>
> Por eso el CRM **comprueba que la demo carga** antes de que Valentina la envíe, y tiene preparada la respuesta "no me carga".

## 5. GitHub (Miguel)

En el repositorio → **Settings**:

1. **Collaborators → Add people**: el usuario de GitHub de Valentina, con rol *Write*.
2. **Rules → Rulesets → New branch ruleset**, sobre la rama por defecto (`main`):
   - *Require a pull request before merging*: 1 aprobación y *Require review from Code Owners*.
   - *Require status checks to pass*: añade "Seguridad, pruebas y base de datos", "CRM en un navegador real" y "Buscar claves en el historial (gitleaks)". Aparecen después del primer Pull Request.
   - *Block force pushes*.
   - En *Bypass list* puedes añadirte tú, como administrador, para emergencias.
3. **Code security**: activa *Dependabot alerts*, *Dependabot security updates*, *Secret scanning* y *Push protection*. Son gratis en repos públicos.
   - Push protection impide subir una clave por error.
   - CodeQL ya está configurado en `.github/workflows/codeql.yml`: **no** actives además el "Default setup".
4. **Actions → General → Workflow permissions**: *Read repository contents*. Es el valor por defecto; déjalo así.

## 6. Comprobar (Miguel)

1. Abre `https://valentina-crm.pages.dev`, entra con tu usuario y añade un negocio de prueba a mano.
2. En una ventana de incógnito, sin entrar, intenta abrir el CRM: solo tiene que salir la pantalla de acceso.

## 7. El ordenador de Valentina (Valentina, con Antigravity)

Necesita Git, Node.js (versión LTS) y Antigravity. Si siguió la guía de la Semana 0, ya los tiene. Si no, en PowerShell:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
```

Después:

```powershell
cd $HOME
mkdir Mavie -Force
cd Mavie
git clone https://github.com/mavieiasolutions-a11y/valentina-call-dashboard.git valentina-crm
cd valentina-crm
npm ci
copy .env.example .env.local
```

1. Abre la carpeta `valentina-crm` en Antigravity (**File → Open Folder**). Antigravity lee `AGENTS.md` y las *skills* de `.agents/` solo.
2. Abre `.env.local` y rellénalo siguiendo [03-aprende-apis.md](03-aprende-apis.md): Supabase, la cuenta del agente y Serper.
3. Comprueba: `npm run probar-apis`.
4. Para probar todo junto, pide a Antigravity: `/buscar-negocios panaderías en Tarifa`.

**Herramientas de dibujo** (gratis, funcionan bien con 8 GB):

- Krita (https://krita.org): ilustración con la tableta.
- Inkscape (https://inkscape.org): logos y dibujos de trazo que luego se animan.

Más en [02-herramientas.md](02-herramientas.md).

--
-- PostgreSQL database dump
--

\restrict 12Z7XF3gIJuiZARPc89Z7RBWdg8h7lINPW25cGLZrezHRs2McFRcD3fqIq8iX49

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.prospectos DROP CONSTRAINT IF EXISTS prospectos_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.hr_requests DROP CONSTRAINT IF EXISTS hr_requests_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.hr_requests DROP CONSTRAINT IF EXISTS hr_requests_reviewed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.credit_requests DROP CONSTRAINT IF EXISTS credit_requests_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.credit_requests DROP CONSTRAINT IF EXISTS credit_requests_reviewed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.board_tasks DROP CONSTRAINT IF EXISTS board_tasks_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.board_tasks DROP CONSTRAINT IF EXISTS board_tasks_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.board_tasks DROP CONSTRAINT IF EXISTS board_tasks_assignee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.board_projects DROP CONSTRAINT IF EXISTS board_projects_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.board_project_members DROP CONSTRAINT IF EXISTS board_project_members_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.board_project_members DROP CONSTRAINT IF EXISTS board_project_members_project_id_fkey;
DROP INDEX IF EXISTS public.idx_users_email;
DROP INDEX IF EXISTS public.idx_transactions_user_id;
DROP INDEX IF EXISTS public.idx_requests_user_id;
DROP INDEX IF EXISTS public.idx_requests_status;
DROP INDEX IF EXISTS public.idx_prospectos_sector;
DROP INDEX IF EXISTS public.idx_notifications_user_id;
DROP INDEX IF EXISTS public.idx_hr_requests_user;
DROP INDEX IF EXISTS public.idx_hr_requests_status;
DROP INDEX IF EXISTS public.idx_board_project_id;
DROP INDEX IF EXISTS public.idx_board_estado;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.prospectos DROP CONSTRAINT IF EXISTS prospectos_pkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_pkey;
ALTER TABLE IF EXISTS ONLY public.hr_requests DROP CONSTRAINT IF EXISTS hr_requests_pkey;
ALTER TABLE IF EXISTS ONLY public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.credit_requests DROP CONSTRAINT IF EXISTS credit_requests_pkey;
ALTER TABLE IF EXISTS ONLY public.board_tasks DROP CONSTRAINT IF EXISTS board_tasks_pkey;
ALTER TABLE IF EXISTS ONLY public.board_projects DROP CONSTRAINT IF EXISTS board_projects_pkey;
ALTER TABLE IF EXISTS ONLY public.board_project_members DROP CONSTRAINT IF EXISTS board_project_members_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_config DROP CONSTRAINT IF EXISTS admin_config_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_config DROP CONSTRAINT IF EXISTS admin_config_key_key;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.prospectos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.notifications ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.hr_requests ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.credit_transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.credit_requests ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.board_tasks ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.board_projects ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.admin_config ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.prospectos_id_seq;
DROP TABLE IF EXISTS public.prospectos;
DROP SEQUENCE IF EXISTS public.notifications_id_seq;
DROP TABLE IF EXISTS public.notifications;
DROP SEQUENCE IF EXISTS public.hr_requests_id_seq;
DROP TABLE IF EXISTS public.hr_requests;
DROP SEQUENCE IF EXISTS public.credit_transactions_id_seq;
DROP TABLE IF EXISTS public.credit_transactions;
DROP SEQUENCE IF EXISTS public.credit_requests_id_seq;
DROP TABLE IF EXISTS public.credit_requests;
DROP SEQUENCE IF EXISTS public.board_tasks_id_seq;
DROP TABLE IF EXISTS public.board_tasks;
DROP SEQUENCE IF EXISTS public.board_projects_id_seq;
DROP TABLE IF EXISTS public.board_projects;
DROP TABLE IF EXISTS public.board_project_members;
DROP SEQUENCE IF EXISTS public.admin_config_id_seq;
DROP TABLE IF EXISTS public.admin_config;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_config (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_config_id_seq OWNED BY public.admin_config.id;


--
-- Name: board_project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.board_project_members (
    project_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: board_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.board_projects (
    id integer NOT NULL,
    nombre character varying(200) NOT NULL,
    descripcion text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: board_projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.board_projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: board_projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.board_projects_id_seq OWNED BY public.board_projects.id;


--
-- Name: board_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.board_tasks (
    id integer NOT NULL,
    titulo text NOT NULL,
    proyecto character varying(200),
    responsable character varying(60),
    tipo character varying(40),
    estado character varying(30) DEFAULT 'Pendiente'::character varying NOT NULL,
    fecha date,
    horas numeric,
    observaciones text,
    orden integer DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    fecha_fin date,
    project_id integer,
    assignee_id integer
);


--
-- Name: board_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.board_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: board_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.board_tasks_id_seq OWNED BY public.board_tasks.id;


--
-- Name: credit_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    project_description text NOT NULL,
    requested_credits integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    admin_notes text,
    reviewed_at timestamp without time zone,
    reviewed_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: credit_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_requests_id_seq OWNED BY public.credit_requests.id;


--
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    amount integer NOT NULL,
    type character varying(30) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: credit_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_transactions_id_seq OWNED BY public.credit_transactions.id;


--
-- Name: hr_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(40) NOT NULL,
    details text,
    start_date date,
    end_date date,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    admin_notes text,
    reviewed_at timestamp without time zone,
    reviewed_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_requests_id_seq OWNED BY public.hr_requests.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: prospectos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospectos (
    id integer NOT NULL,
    ts timestamp without time zone DEFAULT now() NOT NULL,
    sector_id character varying(40),
    sector_nombre character varying(140),
    empresa text NOT NULL,
    ruc character varying(30),
    web text,
    contacto_nombre character varying(140),
    contacto_apellido character varying(140),
    cargo text,
    email character varying(200),
    telefono character varying(60),
    linkedin text,
    fuente character varying(40),
    pilar character varying(60),
    fase_sop character varying(10),
    fecha_fase date,
    extension_pbx character varying(60),
    horario_preferido character varying(140),
    notas text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: prospectos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prospectos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prospectos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prospectos_id_seq OWNED BY public.prospectos.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'user'::character varying NOT NULL,
    credits integer DEFAULT 0 NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    verification_token character varying(255),
    company character varying(200),
    phone character varying(50),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    account_type character varying(20) DEFAULT 'cliente'::character varying NOT NULL,
    "position" character varying(120),
    photo text,
    vacation_total integer DEFAULT 10 NOT NULL,
    vacation_used integer DEFAULT 0 NOT NULL,
    handycoins integer DEFAULT 0 NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: admin_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_config ALTER COLUMN id SET DEFAULT nextval('public.admin_config_id_seq'::regclass);


--
-- Name: board_projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_projects ALTER COLUMN id SET DEFAULT nextval('public.board_projects_id_seq'::regclass);


--
-- Name: board_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_tasks ALTER COLUMN id SET DEFAULT nextval('public.board_tasks_id_seq'::regclass);


--
-- Name: credit_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_requests ALTER COLUMN id SET DEFAULT nextval('public.credit_requests_id_seq'::regclass);


--
-- Name: credit_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions ALTER COLUMN id SET DEFAULT nextval('public.credit_transactions_id_seq'::regclass);


--
-- Name: hr_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_requests ALTER COLUMN id SET DEFAULT nextval('public.hr_requests_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: prospectos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospectos ALTER COLUMN id SET DEFAULT nextval('public.prospectos_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: admin_config; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.admin_config VALUES (1, 'notification_email', 'nicole.flores@turingtech.com.ec', '2026-08-30 16:09:08.14458');
INSERT INTO public.admin_config VALUES (2, 'initial_credits', '2000', '2026-08-30 16:09:08.151843');


--
-- Data for Name: board_project_members; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.board_project_members VALUES (1, 10);
INSERT INTO public.board_project_members VALUES (1, 11);
INSERT INTO public.board_project_members VALUES (1, 9);
INSERT INTO public.board_project_members VALUES (1, 5);
INSERT INTO public.board_project_members VALUES (4, 11);
INSERT INTO public.board_project_members VALUES (2, 5);
INSERT INTO public.board_project_members VALUES (3, 9);
INSERT INTO public.board_project_members VALUES (1, 1);


--
-- Data for Name: board_projects; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.board_projects VALUES (1, 'Turingtech', NULL, 1, '2026-08-30 19:04:14.088364');
INSERT INTO public.board_projects VALUES (2, 'Automatización RPA para la Gestión, Consolidación e Impresión Documental Multi-Sucursal', NULL, 1, '2026-08-30 19:04:14.088364');
INSERT INTO public.board_projects VALUES (3, 'Plataforma Packaging Intelligence', NULL, 1, '2026-08-30 19:04:14.088364');
INSERT INTO public.board_projects VALUES (4, 'Provisión de Infraestructura en la Nube y Servicios de Seguridad', NULL, 1, '2026-08-30 19:04:14.088364');


--
-- Data for Name: board_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.board_tasks VALUES (1, 'Reunión de levantamiento con el equipo de Swissgas para mapear el flujo de impresión y consolidación documental entre sucursales.', 'Automatización RPA para la Gestión, Consolidación e Impresión Documental Multi-Sucursal', 'Jhossua', 'Reunión', 'Finalizada', '2026-08-04', 12, NULL, 9, NULL, '2026-08-30 18:27:02.573293', '2026-08-30 18:42:56.30714', '2026-08-04', 2, 5);
INSERT INTO public.board_tasks VALUES (31, 'PAGINA DE TURINGCOIN PARA LOS CLIENTES ', 'Turingtech', 'Jhossua', 'Desarrollo', 'Finalizada', NULL, 12, NULL, 16, NULL, '2026-08-30 18:27:02.588802', '2026-08-30 18:43:11.79871', NULL, 1, 5);
INSERT INTO public.board_tasks VALUES (7, 'IMPRIMIR TARJETAS (verificar el pdf y si ya se puede imprimir)', 'Turingtech', 'Nicole', 'Desarrollo', 'Control de calidad', '2026-08-04', 22, NULL, 1, NULL, '2026-08-30 18:27:02.578985', '2026-08-30 18:46:43.023771', '2026-08-04', 1, 10);
INSERT INTO public.board_tasks VALUES (9, 'INVESTIGACIÓN DE CONTENIDO PUBLICITARIO PARA REDES SOCIALES', 'Turingtech', 'Nicole', 'Desarrollo', 'Bloqueado', '2026-08-05', 22, NULL, 1, NULL, '2026-08-30 18:27:02.580361', '2026-08-30 18:46:45.703944', '2026-08-05', 1, 10);
INSERT INTO public.board_tasks VALUES (2, 'Auditoría de seguridad inicial y evaluación de proveedores cloud para el diseño de la arquitectura.', 'Provisión de Infraestructura en la Nube y Servicios de Seguridad', 'Wendy', 'Investigación', 'Tareas por hacer', '2026-08-04', 17, NULL, 2, NULL, '2026-08-30 18:27:02.575102', '2026-08-30 18:27:02.575102', '2026-08-04', 4, 11);
INSERT INTO public.board_tasks VALUES (3, 'Definición de interfaz preliminar y alcance de métricas de la plataforma Packaging Intelligence.', 'Plataforma Packaging Intelligence', 'Leonel', 'Desarrollo', 'Tareas por hacer', '2026-08-04', 22, NULL, 3, NULL, '2026-08-30 18:27:02.57588', '2026-08-30 18:27:02.57588', '2026-08-04', 3, 9);
INSERT INTO public.board_tasks VALUES (4, 'PAGINA WEB PUBLICACIÓN Y SEO', 'Turingtech', 'Wendy', 'Desarrollo', 'Tareas por hacer', '2026-08-04', 12, NULL, 4, NULL, '2026-08-30 18:27:02.576824', '2026-08-30 18:27:02.576824', '2026-08-04', 1, 11);
INSERT INTO public.board_tasks VALUES (5, 'REVISAR PLAN DE PROSPECCIÓN COOPERATIVAS', 'Turingtech', 'Wendy', 'Desarrollo', 'Tareas por hacer', '2026-08-09', 12, NULL, 5, NULL, '2026-08-30 18:27:02.577784', '2026-08-30 18:27:02.577784', '2026-08-09', 1, 11);
INSERT INTO public.board_tasks VALUES (6, 'REUNION DE CONTABILIDAD CONFIRMACION', 'Turingtech', 'Wendy', 'Desarrollo', 'Tareas por hacer', '2026-08-03', 12, NULL, 6, NULL, '2026-08-30 18:27:02.578309', '2026-08-30 18:27:02.578309', '2026-08-03', 1, 11);
INSERT INTO public.board_tasks VALUES (8, 'SEGUIMIENTO DE LOS PROSPECTOS', 'Turingtech', 'Nicole', 'Desarrollo', 'Finalizada', '2026-08-07', NULL, 'como se sigue desarrollando la pagina de creditos no me comunique con eko-packing', 8, NULL, '2026-08-30 18:27:02.579666', '2026-08-30 18:27:02.579666', '2026-08-07', 1, 10);
INSERT INTO public.board_tasks VALUES (35, 'REUNION DE AVANCES 8:00PM', 'Turingtech', 'Todos', 'Reunión', 'Tareas por hacer', '2026-08-26', 12, NULL, 35, NULL, '2026-08-30 18:27:02.590365', '2026-08-30 18:27:02.590365', '2026-08-26', 1, NULL);
INSERT INTO public.board_tasks VALUES (36, 'REUNION  DE AVANCES  8:00PM', 'Turingtech', 'Todos', 'Reunión', 'Tareas por hacer', '2026-08-30', 12, NULL, 36, NULL, '2026-08-30 18:27:02.590784', '2026-08-30 18:27:02.590784', '2026-08-30', 1, NULL);
INSERT INTO public.board_tasks VALUES (18, 'SEO LINKEND, FACEBOOK, X/TWITTER (SI HAY)', 'Turingtech', 'Jhossua', 'Desarrollo', 'Finalizada', '2026-08-05', 12, NULL, 10, NULL, '2026-08-30 18:27:02.584357', '2026-08-30 18:42:59.286134', '2026-08-05', 1, 5);
INSERT INTO public.board_tasks VALUES (19, 'PLAN DE PROSPECCCION COOPERATIVAS', 'Turingtech', 'Jhossua', 'Desarrollo', 'Finalizada', '2026-08-07', 22, NULL, 11, NULL, '2026-08-30 18:27:02.584715', '2026-08-30 18:43:01.903517', '2026-08-07', 1, 5);
INSERT INTO public.board_tasks VALUES (29, 'CAMBIOS DE PAGINA DE PROSPECTOS ', 'Turingtech', 'Jhossua', 'Desarrollo', 'Finalizada', '2026-08-25', 12, NULL, 12, NULL, '2026-08-30 18:27:02.587916', '2026-08-30 18:43:03.519566', '2026-08-25', 1, 5);
INSERT INTO public.board_tasks VALUES (32, 'DISEÑO DE CREDENCIALES ', 'Turingtech', 'Jhossua', 'Desarrollo', 'Finalizada', '2026-08-28', 22, NULL, 13, NULL, '2026-08-30 18:27:02.589174', '2026-08-30 18:43:05.413582', '2026-08-28', 1, 5);
INSERT INTO public.board_tasks VALUES (30, 'LOGOTIPO DE SELLO Y PANFLETOS ', 'Turingtech', 'Jhossua', 'Desarrollo', 'Finalizada', '2026-08-29', 22, NULL, 14, NULL, '2026-08-30 18:27:02.588373', '2026-08-30 18:43:08.087524', '2026-08-29', 1, 5);
INSERT INTO public.board_tasks VALUES (33, 'TURINGCONI INTERNO ', 'Turingtech', 'Jhossua', 'Desarrollo', 'Finalizada', '2026-08-30', 12, NULL, 15, NULL, '2026-08-30 18:27:02.589529', '2026-08-30 18:43:10.086991', '2026-08-30', 1, 5);
INSERT INTO public.board_tasks VALUES (10, 'GENERAR 1 PUBLICAD', 'Turingtech', 'Nicole', 'Desarrollo', 'En curso', '2026-08-07', 22, NULL, 1, NULL, '2026-08-30 18:27:02.580994', '2026-08-30 18:46:49.719347', '2026-08-07', 1, 10);
INSERT INTO public.board_tasks VALUES (11, 'DESARROLLO DE BITACORA', 'Turingtech', 'Nicole', 'Desarrollo', 'En curso', '2026-08-07', 22, NULL, 2, NULL, '2026-08-30 18:27:02.581535', '2026-08-30 18:46:51.22974', '2026-08-07', 1, 10);
INSERT INTO public.board_tasks VALUES (12, 'PLAN DE PROSPECCION NEGOCIO', 'Turingtech', 'Nicole', 'Desarrollo', 'En curso', '2026-08-07', 22, NULL, 3, NULL, '2026-08-30 18:27:02.581972', '2026-08-30 18:46:53.303583', '2026-08-07', 1, 10);
INSERT INTO public.board_tasks VALUES (21, 'INFORMACION DE LA CAMARA DE COMERCIO ', 'Turingtech', 'Nicole', 'Desarrollo', 'En curso', '2026-08-26', 22, NULL, 4, NULL, '2026-08-30 18:27:02.585385', '2026-08-30 18:46:55.326982', '2026-08-26', 1, 10);
INSERT INTO public.board_tasks VALUES (22, 'LISTADO DE PROSPECTOS', 'Turingtech', 'Nicole', 'Desarrollo', 'En curso', '2026-08-31', 12, NULL, 5, NULL, '2026-08-30 18:27:02.585681', '2026-08-30 18:46:57.614398', '2026-08-31', 1, 10);
INSERT INTO public.board_tasks VALUES (13, 'REVISAR PLAN DE PROSPECCIÓN', 'Turingtech', 'Todos', 'Desarrollo', 'Tareas por hacer', '2026-08-04', 12, NULL, 13, NULL, '2026-08-30 18:27:02.58243', '2026-08-30 18:27:02.58243', '2026-08-04', 1, NULL);
INSERT INTO public.board_tasks VALUES (14, 'REVISIÓN SEO QA', 'Turingtech', 'Leonel', 'Desarrollo', 'Tareas por hacer', '2026-08-05', 22, NULL, 14, NULL, '2026-08-30 18:27:02.582839', '2026-08-30 18:27:02.582839', '2026-08-05', 1, 9);
INSERT INTO public.board_tasks VALUES (15, 'BASE DE DATOS SUPABASE METADATOS DE LA PAGINA WEB', 'Turingtech', 'Leonel', 'Desarrollo', 'Tareas por hacer', '2026-08-07', 22, NULL, 15, NULL, '2026-08-30 18:27:02.583225', '2026-08-30 18:27:02.583225', '2026-08-07', 1, 9);
INSERT INTO public.board_tasks VALUES (16, 'ENVIAR ESTADOS DE CUENTA MARCO', 'Turingtech', 'Leonel', 'Desarrollo', 'Tareas por hacer', '2026-08-04', 22, NULL, 16, NULL, '2026-08-30 18:27:02.583627', '2026-08-30 18:27:02.583627', '2026-08-04', 1, 9);
INSERT INTO public.board_tasks VALUES (17, 'DESHABILITAR FACTURACIÓN GOOGLE', 'Turingtech', 'Leonel', 'Desarrollo', 'Tareas por hacer', '2026-08-04', 41, NULL, 17, NULL, '2026-08-30 18:27:02.584021', '2026-08-30 18:27:02.584021', '2026-08-04', 1, 9);
INSERT INTO public.board_tasks VALUES (20, 'VER HORA LIBRE EN EL TEAMS', 'Turingtech', 'Todos', 'Desarrollo', 'Tareas por hacer', '2026-08-09', 12, NULL, 20, NULL, '2026-08-30 18:27:02.585022', '2026-08-30 18:27:02.585022', '2026-08-09', 1, NULL);
INSERT INTO public.board_tasks VALUES (23, 'SEO DE LA EMPRESA ', 'Turingtech', 'Leonel', 'Desarrollo', 'Tareas por hacer', '2026-08-30', 12, NULL, 23, NULL, '2026-08-30 18:27:02.58598', '2026-08-30 18:27:02.58598', '2026-08-30', 1, 9);
INSERT INTO public.board_tasks VALUES (24, 'CALENDARIO DE PUBLICIDADES ', 'Turingtech', 'Leonel', 'Desarrollo', 'Tareas por hacer', '2026-08-28', 22, NULL, 24, NULL, '2026-08-30 18:27:02.586279', '2026-08-30 18:27:02.586279', '2026-08-28', 1, 9);
INSERT INTO public.board_tasks VALUES (25, 'DISEÑO INICIATIVA DE UBER ', 'Turingtech', 'Leonel', 'Desarrollo', 'Tareas por hacer', '2026-08-25', 22, NULL, 25, NULL, '2026-08-30 18:27:02.586562', '2026-08-30 18:27:02.586562', '2026-08-25', 1, 9);
INSERT INTO public.board_tasks VALUES (26, 'PRODUCTOS PEQUEÑOS PARA COMERCIALIZAR ', 'Turingtech', 'Leonel', 'Desarrollo', 'Tareas por hacer', '2026-08-26', 22, NULL, 26, NULL, '2026-08-30 18:27:02.586848', '2026-08-30 18:27:02.586848', '2026-08-26', 1, 9);
INSERT INTO public.board_tasks VALUES (27, 'DISEÑO DE PANFLETOS Y SELLO', 'Turingtech', 'Wendy', 'Desarrollo', 'Tareas por hacer', '2026-08-30', 12, NULL, 27, NULL, '2026-08-30 18:27:02.587155', '2026-08-30 18:27:02.587155', '2026-08-30', 1, 11);
INSERT INTO public.board_tasks VALUES (28, 'PRECIO DE CREDENCIALES,PANFLETOS Y SELLO ', 'Turingtech', 'Wendy', 'Desarrollo', 'Tareas por hacer', '2026-09-01', 12, NULL, 28, NULL, '2026-08-30 18:27:02.587506', '2026-08-30 18:27:02.587506', '2026-09-01', 1, 11);
INSERT INTO public.board_tasks VALUES (34, 'PROPUESTA DISEÑO DE PUBLICIDAD PARA UNIVERSITARIOS ', 'Turingtech', 'Wendy', 'Desarrollo', 'Tareas por hacer', '2026-08-30', 12, NULL, 34, NULL, '2026-08-30 18:27:02.589941', '2026-08-30 18:27:02.589941', '2026-08-30', 1, 11);


--
-- Data for Name: credit_requests; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.credit_requests VALUES (2, 1, '[Automatización RPA] sdasdas — Prioridad: Alta — Inicio estimado: 2026-08-30

asdasdasd', 5000, 'approved', NULL, '2026-08-30 17:16:45.078237', 1, '2026-08-30 16:43:43.453485');
INSERT INTO public.credit_requests VALUES (1, 2, '[Automatizaci�n RPA] Conciliaciones � Prioridad: Alta � Inicio estimado: 2026-09-15

Automatizar la conciliacion diaria.', 1500, 'approved', NULL, '2026-08-30 17:17:00.133617', 1, '2026-08-30 16:41:43.66774');
INSERT INTO public.credit_requests VALUES (3, 1, '[Automatización RPA] asdasda — Prioridad: Alta — Inicio estimado: 2026-08-30

asdasdasdas', 1500, 'approved', NULL, '2026-08-30 17:17:47.089914', 1, '2026-08-30 17:17:42.260929');


--
-- Data for Name: credit_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.credit_transactions VALUES (6, 1, 5000, 'admin_grant', 'Créditos aprobados por solicitud de proyecto', '2026-08-30 17:16:45.078237');
INSERT INTO public.credit_transactions VALUES (7, 2, 1500, 'admin_grant', 'Créditos aprobados por solicitud de proyecto', '2026-08-30 17:17:00.133617');
INSERT INTO public.credit_transactions VALUES (8, 1, 1500, 'admin_grant', 'Créditos aprobados por solicitud de proyecto', '2026-08-30 17:17:47.089914');
INSERT INTO public.credit_transactions VALUES (9, 1, -500, 'admin_grant', 'proyecto1 aplicado', '2026-08-30 17:26:09.156025');
INSERT INTO public.credit_transactions VALUES (10, 2, -300, 'admin_grant', 'Consumo de cr�ditos en proyecto piloto', '2026-08-30 17:29:20.009985');


--
-- Data for Name: hr_requests; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.hr_requests VALUES (3, 5, 'certificado_laboral', 'asdasdasd', NULL, NULL, 'approved', NULL, '2026-08-30 19:45:13.859654', 1, '2026-08-30 18:04:31.362448');


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notifications VALUES (4, 1, '¡Solicitud aprobada!', 'Tu solicitud de 5000 créditos ha sido aprobada. Ya están disponibles en tu cuenta.', 'credit_approved', false, '2026-08-30 17:16:45.078237');
INSERT INTO public.notifications VALUES (5, 2, '¡Solicitud aprobada!', 'Tu solicitud de 1500 créditos ha sido aprobada. Ya están disponibles en tu cuenta.', 'credit_approved', false, '2026-08-30 17:17:00.133617');
INSERT INTO public.notifications VALUES (6, 1, '¡Solicitud aprobada!', 'Tu solicitud de 1500 créditos ha sido aprobada. Ya están disponibles en tu cuenta.', 'credit_approved', false, '2026-08-30 17:17:47.089914');
INSERT INTO public.notifications VALUES (7, 1, 'Créditos actualizados', 'El administrador ha ajustado tus créditos en -500. Motivo: proyecto1 aplicado', 'credit_modified', false, '2026-08-30 17:26:09.156025');
INSERT INTO public.notifications VALUES (11, 5, 'Solicitud aprobada', 'Tu solicitud de Certificado laboral fue aprobada.', 'hr_approved', false, '2026-08-30 19:45:13.859654');


--
-- Data for Name: prospectos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.prospectos VALUES (1, '2026-08-26 19:20:41', 'logistica', 'Logística y Transporte', 'prueba', 'a12321312312', 'http://ww.pruba.com', NULL, NULL, NULL, NULL, NULL, NULL, 'LinkedIn', 'RPA', '1', '2026-08-26', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.967156');
INSERT INTO public.prospectos VALUES (2, '2026-08-12 16:04:20', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Jep', '0190115798001', 'https://www.jep.coop/', NULL, NULL, 'Gerente de Operaciones', NULL, NULL, NULL, 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, '📢 Invitamos a empresas legalmente constituidas, especializadas en recuperación de créditos y tarjetas de crédito, a participar en nuestra ronda de negocios. 📩 Para participar, confirme su interés y remita su carta de presentación al correo ysarango@jep.coop hasta el viernes 7 de agosto de 2026. 📅 Esperamos contar con su participación el 12 de agosto de 2026, a las 09h00, en la AgenciaJEP Bolívar (Bolívar entre Padre Aguirre y General Torres).', NULL, '2026-08-30 18:43:57.968693');
INSERT INTO public.prospectos VALUES (3, '2026-08-12 16:09:05', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Jep', '0190115798001', 'https://www.jep.coop/', 'Marcelo', 'Ordoñez', 'Gerente de Crédito, Riesgo y Cobranzas | Estrategia Financiera | Portafolios Corporativos | Innovación en Productos y Medios de Pago', NULL, NULL, 'https://www.linkedin.com/in/marcelo-ord%C3%B3%C3%B1ez-564001b5/', 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.969399');
INSERT INTO public.prospectos VALUES (4, '2026-08-12 16:34:10', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Policía Nacional', '1790866084001', 'https://www.cpn.fin.ec/', 'Carmen', 'Jativa', 'Gestión de procesos / Gestión de Calidad / Analista de Adquisiciones / Control Interno / Auditor Líder / Auditor Interno', NULL, NULL, 'https://www.linkedin.com/in/carmen-j%C3%A1tiva-093b9387/recent-activity/all/', 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.969947');
INSERT INTO public.prospectos VALUES (5, '2026-08-12 16:57:35', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa De Ahorro Y Crédito "29 De Octubre" Ltda.', '1790567699001', 'https://www.29deoctubre.fin.ec/inicio/gad_source/1/gad_campaignid/21284771004/gbraid/0aaaaa9tw9ej4e-8jc-c_llrzz9fchp1mj/gclid/cjwkcajws_dtbhb_eiwaxzkngwuem_mj0s4wvvzmyktdg4pwmcvs68l2kwhersqb1_hclxmybhtfzroc0n4qavd_bwe', 'Juan Carlos', 'Bazantes Gaona', 'Gerente La29 | Liderazgo estratégico, comercial y financiero', NULL, NULL, 'https://www.linkedin.com/in/juan-carlos-basantez-gaona-928a33257/', 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.970482');
INSERT INTO public.prospectos VALUES (6, '2026-08-12 17:50:08', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Mushuc Runa', '1890141877001', 'https://mushucruna.com/', 'Juan Diego', 'Yunga', 'Supervisor de Operaciones', NULL, NULL, 'https://www.linkedin.com/in/juan-diego-yunga-7b86b8177/', 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.970952');
INSERT INTO public.prospectos VALUES (7, '2026-08-12 21:09:30', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Coac Oscus', '1890001323001', 'https://oscus.coop/', 'Luis', 'Orozco', 'Responsable de la Gestión Jurídica OSCUS COOPERATIVA DE AHORRO Y CREDITO', NULL, NULL, NULL, 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.971495');
INSERT INTO public.prospectos VALUES (8, '2026-08-12 21:44:27', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Vis Andes', '0591719718001', 'https://www.visandes.fin.ec/', 'Luis', 'Rubio', 'PROYECT MANAGER', NULL, NULL, 'https://www.linkedin.com/in/luis-rubio-526691a1/', 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.971965');
INSERT INTO public.prospectos VALUES (9, '2026-08-12 21:49:04', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Huancavilca', '0992280700001', 'https://cooperativahuancavilca.com/', 'Luis Alberto', 'Caisa Galarza', 'Gerente General Cooperativa Huancavilca Ltda', NULL, NULL, NULL, 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.972415');
INSERT INTO public.prospectos VALUES (10, '2026-08-12 21:53:07', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa De La Policia Nacional', '1790866084001', 'https://www.cpn.fin.ec/', 'Michelle', 'Altamirano', 'Jefe de Negocios en Coooperativa de Ahorro y crédito Policia Nacional', NULL, NULL, 'https://www.linkedin.com/in/michelle-altamirano-9400a7305/', 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.972947');
INSERT INTO public.prospectos VALUES (11, '2026-08-12 21:59:23', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa San Francisco De Asis', '1790045668001', 'https://www.asis.fin.ec/', 'Estuardo', 'Paredez López', 'Principal Chief Executive Officer en COAC SAN FRANCISCO LTDA.', NULL, NULL, 'https://www.linkedin.com/in/estuardo-paredes-1530421b7/', 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.973713');
INSERT INTO public.prospectos VALUES (12, '2026-08-12 22:05:31', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa San Francisco De Asis', '1790045668001', 'https://www.asis.fin.ec/', 'Santiago', 'Bastidas Burbano', 'Jefe Administrativo y Seguridad Física en Cooperativa de Ahorro y Crédito San Francisco de Asís Ltda', NULL, NULL, 'https://www.linkedin.com/in/santiago-bastidas-burbano-6920a51a8/', 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, 'numero de la matriz es 22540518', NULL, '2026-08-30 18:43:57.974597');
INSERT INTO public.prospectos VALUES (13, '2026-08-12 22:08:20', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa San Francisco De Asis', '1790045668001', 'https://www.asis.fin.ec/', 'Estuardo', 'Paredez López', 'Principal Chief Executive Officer en COAC SAN FRANCISCO LTDA.', 'javalos@csfasis.fin.ec', NULL, 'https://www.linkedin.com/in/estuardo-paredes-1530421b7/', 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.975306');
INSERT INTO public.prospectos VALUES (14, '2026-08-12 22:14:42', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa San Fransisco De Asis', '1790045668001', 'https://www.asis.fin.ec/', 'Veronica', 'Vega', 'Auditora Interna en COAC San Francisco de Asís Ltda', NULL, NULL, 'https://www.linkedin.com/in/ver%C3%B3nicavega12/', 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, 'correo para propuestas,corporativas, correo institucional :teamsanfrancisco@asis.fin.ec', NULL, '2026-08-30 18:43:57.975875');
INSERT INTO public.prospectos VALUES (15, '2026-08-12 22:31:14', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa 23 De Julio', NULL, 'https://coop23dejulio.fin.ec/', 'Mónica Nicolalde', 'Castillo', 'Gerente de Operaciones', NULL, NULL, 'https://www.linkedin.com/in/m%C3%B3nica-nicolalde-castillo-9b341478/', 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, 'correo institucional de la cooperativa : protecciondatoslegales@coop23dejulio.fin.ec', NULL, '2026-08-30 18:43:57.976346');
INSERT INTO public.prospectos VALUES (16, '2026-08-12 22:36:01', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa 23 De Julio', '1790093204001', 'https://coop23dejulio.fin.ec/', 'Carlos Luis', 'Abad Buenaño', 'Jefe comercial en Cooperativa de Ahorro y Crédito 23 de Julio', NULL, NULL, 'https://www.linkedin.com/in/carlos-luis-abad-buena%C3%B1o-28b598251/', 'LinkedIn', 'RPA', '1', '2026-08-12', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.97678');
INSERT INTO public.prospectos VALUES (17, '2026-08-13 11:57:44', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Coac Atuntaqui', '1090033456001', 'https://www.atuntaqui.fin.ec/', 'Alfredo', 'Arteaga', 'Director de Negocios Coac Atuntaqui.', NULL, NULL, 'https://www.linkedin.com/in/alfredo-arteaga-39b175312/', 'LinkedIn', 'RPA', '1', '2026-08-13', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.977208');
INSERT INTO public.prospectos VALUES (18, '2026-08-13 12:00:46', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Atuntaqui', '1090033456001', 'https://www.atuntaqui.fin.ec/', 'Jenny', 'Maldonado Landeta', NULL, NULL, NULL, 'https://www.linkedin.com/in/jenny-maldonado-landeta-a56370155/', 'LinkedIn', 'RPA', '1', '2026-08-13', NULL, NULL, 'Correo de atención virtual / institucional: coopvirtual@atuntaqui.fin.ec', NULL, '2026-08-30 18:43:57.977684');
INSERT INTO public.prospectos VALUES (19, '2026-08-13 13:26:04', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Pichincha', '1792057043001', 'https://www.coopichincha.com.ec/', 'Santiago', 'Gualotuna', 'Gerente general en Cooperativa Pichincha', NULL, NULL, 'https://www.linkedin.com/in/santiago-gualotuna-479a47319/', 'LinkedIn', 'RPA', '1', '2026-08-13', NULL, NULL, 'Correo electrónico general: info@coopichincha.com.ec', NULL, '2026-08-30 18:43:57.978067');
INSERT INTO public.prospectos VALUES (20, '2026-08-13 17:30:56', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'San Miguel De Pallatanga Coac', '0690074397001', 'https://coacsmp.fin.ec/', 'Ivan', 'Tenelanda', 'Gerente general en Cooperativa San Miguel de Pallatanga', NULL, NULL, 'https://www.linkedin.com/in/iv%C3%A1n-tenelanda-62162b285/', 'LinkedIn', 'RPA', '1', '2026-08-13', NULL, NULL, 'correo institucional:sanmigueldepalatanga@coacsmp.com', NULL, '2026-08-30 18:43:57.978418');
INSERT INTO public.prospectos VALUES (21, '2026-08-13 17:39:02', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Mushuc Runa', '1890141877001', 'https://mushucruna.com/', 'Luis Alfonso', 'Chango Pacha', 'Gerente General en COAC Mushuc Runa', NULL, NULL, 'https://www.linkedin.com/in/luis-alfonso-chango-21b9532a1/', 'LinkedIn', 'RPA', '1', '2026-08-13', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.978769');
INSERT INTO public.prospectos VALUES (22, '2026-08-20 15:19:11', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa De Ahorro Y Crédito Andalucía Ltda.', '1790325083001', 'https://andalucia.fin.ec/', 'Michelle', 'Almeida Clavijo', 'Jefe de Captaciones en Cooperativa Andalucía', NULL, NULL, 'https://www.linkedin.com/in/michelle-almeida-clavijo-6247b023a/', 'LinkedIn', 'RPA', '1', '2026-08-20', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.979238');
INSERT INTO public.prospectos VALUES (23, '2026-08-20 15:21:15', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Andalucia', '1790325083001', 'https://andalucia.fin.ec/', 'Maria Augusta', 'Cevallos', 'Jefe de Inversiones en Cooperativa Andalucía con experiencia en asesoramiento financiero', NULL, NULL, 'https://www.linkedin.com/in/mar%C3%ADa-augusta-cevallos-419310231/', 'LinkedIn', 'RPA', '1', '2026-08-20', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.979718');
INSERT INTO public.prospectos VALUES (24, '2026-08-20 18:11:02', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Andalucia', '1790325083001', 'https://andalucia.fin.ec/', 'Freddy', 'Duque Vallejo', 'Jefe de Recursos Humanos en Cooperativa Andalucia Ltda', NULL, NULL, 'https://www.linkedin.com/in/freddy-duque-vallejo-7391bb5a/', 'LinkedIn', 'RPA', '1', '2026-08-20', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.981118');
INSERT INTO public.prospectos VALUES (25, '2026-08-20 18:19:27', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa De Ahorro Y Crédito Andalucía Ltda.', '1790325083001', 'https://andalucia.fin.ec/', 'Esteban', 'Correa', 'Subgerente Comercial  Cooperativa Andalucía', NULL, NULL, 'https://www.linkedin.com/in/esteban-correa-5a263229/', 'LinkedIn', 'RPA', '1', '2026-08-20', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.981829');
INSERT INTO public.prospectos VALUES (26, '2026-08-20 18:21:19', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa De Ahorro Y Crédito Andalucía Ltda.', '1790325083001', 'https://andalucia.fin.ec/', 'Catherine', 'Garrido', 'Coordinador de Talento Humano en COOPERATIVA ANDALUCIA LTDA.', NULL, NULL, 'https://www.linkedin.com/in/catherine-garrido-94641a4a/', 'LinkedIn', 'RPA', '1', '2026-08-20', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.982416');
INSERT INTO public.prospectos VALUES (27, '2026-08-20 18:49:12', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Coopcentro', '1791306589001', 'https://www.coopcentro.fin.ec/coopcentro-en-linea/', 'Alejandra', 'Llenera', 'Jefa de Talento Humano en Cooperativa Coop Centro', NULL, NULL, 'https://www.linkedin.com/in/alejandra-llerena-29aa44274/', 'LinkedIn', 'RPA', '1', '2026-08-20', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.983029');
INSERT INTO public.prospectos VALUES (28, '2026-08-20 21:13:38', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Sierra Centro', '0591719009001', 'https://sierracentro.fin.ec/', 'Angel', 'Yucaila', NULL, NULL, NULL, NULL, 'LinkedIn', 'RPA', '1', '2026-08-20', NULL, NULL, 'Enlace de reunión: https://us06web.zoom.us/j/85800528869', NULL, '2026-08-30 18:43:57.983603');
INSERT INTO public.prospectos VALUES (29, '2026-08-20 21:16:23', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa 15 De Abril', '1390013678001', 'https://www.coop15abril.fin.ec/', 'María Verónica', 'Mendoza Cevallos', 'Gerente General en Cooperativa de Ahorro y Crédito "15 de Abril Ltda."', NULL, NULL, 'https://www.linkedin.com/in/mar%C3%ADa-ver%C3%B3nica-mendoza-cevallos-430120212/', 'LinkedIn', 'RPA', '1', '2026-08-20', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.984051');
INSERT INTO public.prospectos VALUES (30, '2026-08-20 21:18:25', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Atuntaqui', '1090033456001', 'https://www.atuntaqui.fin.ec/', 'Ronald', 'Macías Herrera', 'Gerente de Operaciones en Cooperativa de Ahorro y Crédito Atuntaqui Ltda', NULL, NULL, 'https://www.linkedin.com/in/ronald-mac%C3%ADas-herrera-191385108/', 'LinkedIn', 'RPA', '1', '2026-08-20', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.984469');
INSERT INTO public.prospectos VALUES (31, '2026-08-21 13:36:28', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Dos Pinos', NULL, 'https://www.cooperativadospinos.com/', 'Luis Alberto', 'Alfonso Monterroso', 'Gerente General Cooperativa de Productores de Leche R.L. - Dos Pinos', NULL, NULL, 'https://www.linkedin.com/in/luis-alfonso-82b80734/', 'LinkedIn', 'RPA', '1', '2026-08-21', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.984817');
INSERT INTO public.prospectos VALUES (32, '2026-08-21 13:39:16', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa De Productores De Leche R.L - Dos Pinos', NULL, 'https://www.cooperativadospinos.com/', 'Ronald', 'Vargas', 'Director en Cooperativa de Productores de Leche R.L - Dos Pinos', NULL, NULL, 'https://www.linkedin.com/in/ronald-vargas-abbb3b210/', 'LinkedIn', 'RPA', '1', '2026-08-21', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.985196');
INSERT INTO public.prospectos VALUES (33, '2026-08-21 13:41:12', 'cooperativas', 'Cooperativas de Ahorro y Crédito', 'Cooperativa Dos Pinos', NULL, 'https://www.cooperativadospinos.com/', 'Susana', 'Piñeiro Baldomir', 'Corporate Human Talent Director - CA&C - Cooperativa de Productores de Leche Dos Pinos', NULL, NULL, NULL, 'LinkedIn', 'RPA', '1', '2026-08-21', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.985564');
INSERT INTO public.prospectos VALUES (34, '2026-08-24 10:28:05', 'retail', 'Retail Grande, Franquicias y Cadenas de Tiendas', 'Compañía De Galletas Pozuelo Dcr, S.A.', '3101420995', 'https://pozuelo.com/', 'Margarita Maria', 'Gomez Espinel', 'Gerente General Pozuelo en Compañía de Galletas Pozuelo DCR, S.A.', NULL, NULL, 'https://www.linkedin.com/in/margarita-maria-gomez-espinel-a095203a6/', 'LinkedIn', 'RPA', '1', '2026-08-24', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.985938');
INSERT INTO public.prospectos VALUES (35, '2026-08-24 10:33:13', 'retail', 'Retail Grande, Franquicias y Cadenas de Tiendas', 'Compañía De Galletas Pozuelo Dcr', '3101420995', 'https://pozuelo.com/', 'Esteban', 'Barrientos Zapata', 'Gerente de Gestión Comercial CAM', NULL, NULL, 'https://www.linkedin.com/in/esteban-barrientos-zapata-aa8a38177/', 'LinkedIn', 'RPA', '1', '2026-08-24', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.986341');
INSERT INTO public.prospectos VALUES (36, '2026-08-24 10:35:28', 'retail', 'Retail Grande, Franquicias y Cadenas de Tiendas', 'Compañía De Galletas Pozuelo Dcr, S.A.', '3101420995', 'https://pozuelo.com/', 'Katherin', 'Ramirez Orozco', 'Especialista en Dirección Comercial |Desarrollo de Clientes y Canales de venta', NULL, NULL, 'https://www.linkedin.com/in/katherinramirezorozco/', 'LinkedIn', 'RPA', '1', '2026-08-24', NULL, NULL, 'Canal: Moderno, Autoservicios, Mayorista y Tradicional', NULL, '2026-08-30 18:43:57.98669');
INSERT INTO public.prospectos VALUES (37, '2026-08-26 19:42:23', 'automotrices', 'Concesionarios Automotrices y Ensambladoras', 'Automotores Latinoamericanos S.A. Autolasa', '0990810311001', NULL, 'Andres', 'Medardo', 'Gerente de Mercadeo en Autolasa, concesionario Chevrolet', NULL, NULL, 'https://www.linkedin.com/in/andres-medardo-maldonado-peralta-18048177/', 'LinkedIn', 'RPA', '1', '2026-08-26', NULL, NULL, 'https://www.facebook.com/Autolasa/?locale=es_LA', NULL, '2026-08-30 18:43:57.987129');
INSERT INTO public.prospectos VALUES (38, '2026-08-26 19:46:36', 'importadoras', 'Importadoras y Distribuidoras', 'Megamicro Mayorista', '1791353897001', 'https://megamicro-ec.com/', 'Isabel', 'Gonzales Peña', 'Gerente Regional en Megamicro Mayorista S.A.', NULL, NULL, 'https://www.linkedin.com/in/isabel-gonz%C3%A1lez-pe%C3%B1a-240909233/', 'LinkedIn', 'RPA', '1', '2026-08-26', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.987517');
INSERT INTO public.prospectos VALUES (39, '2026-08-27 13:05:38', 'automotrices', 'Concesionarios Automotrices y Ensambladoras', 'Importadora Tomebamba S.A.', '0190003701001', 'https://www.tomebamba.com.ec/', 'Juan Fernando', 'Vasquez', 'Subgerente General at Importadora Tomebamba S.A.', NULL, NULL, 'https://www.linkedin.com/in/juan-fernando-vasquez-15b66236/', 'LinkedIn', 'RPA', '1', '2026-08-27', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.987864');
INSERT INTO public.prospectos VALUES (40, '2026-08-27 13:08:26', 'construccion', 'Construcción e Inmobiliarias Grandes', 'indurama', '0190014207001', 'https://www.indurama.com/?srsltid=AfmBOopqY_FJnvxQOW9QWu9GYunHY-MGz4mFznGZflK4u2mnU7v5AXE6', 'Fabian', 'Carvallo Coellar', 'Gerente General Indurama', NULL, NULL, 'https://www.linkedin.com/in/fabiancarvallocoellar/', 'LinkedIn', 'RPA', '1', '2026-08-27', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.988204');
INSERT INTO public.prospectos VALUES (41, '2026-08-27 13:39:41', 'importadoras', 'Importadoras y Distribuidoras', 'Grupo Consenso', '0190358275001', 'https://www.consensocorp.com/', 'Luis Javier', 'Rios Hoyo', 'Presidente ejecutivo & CEO Grupo Consenso (Indurama-Marcimex-Mercandina-Serinco)', NULL, NULL, 'https://www.linkedin.com/in/luis-javier-rios-hoyos-0757a242/', 'LinkedIn', 'RPA', '1', '2026-08-27', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.98869');
INSERT INTO public.prospectos VALUES (42, '2026-08-27 18:45:08', 'importadoras', 'Importadoras y Distribuidoras', 'cartimex s.a', '0991400427001', 'https://www.cartimex.com/', 'Jose Luis', 'Larrea', 'Gerente General Computron/Cartimex', NULL, NULL, 'https://www.linkedin.com/in/jose-luis-larrea-ba3a8062/', 'LinkedIn', 'RPA', '1', '2026-08-27', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.989017');
INSERT INTO public.prospectos VALUES (43, '2026-08-27 18:51:02', 'importadoras', 'Importadoras y Distribuidoras', 'cartimex s.a', '0991400427001', 'https://www.cartimex.com/', 'Kelly', 'Tomala Contreras', 'Jefe de Talento Humano', NULL, NULL, 'https://www.linkedin.com/in/kelly-tomal%C3%A1-contreras-b3739479/', 'LinkedIn', 'RPA', '1', '2026-08-27', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.98948');
INSERT INTO public.prospectos VALUES (44, '2026-08-27 18:58:12', 'construccion', 'Construcción e Inmobiliarias Grandes', 'Panavial', '1791317025001', 'https://www.panavial.com/', 'Diego Eduardo', 'Salas Navarrete', 'Director de Operaciones en Panavial S.A.', NULL, NULL, 'https://www.linkedin.com/in/diego-salas-56818040/', 'LinkedIn', 'RPA', '1', '2026-08-27', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.99007');
INSERT INTO public.prospectos VALUES (45, '2026-08-27 21:35:37', 'construccion', 'Construcción e Inmobiliarias Grandes', 'SUDINCO.S.A', '1790258688001', 'http://gruposudinco.com/', 'Ramiro Javier', 'Freire Rodríguez.', 'Vicepresidente ejecutivo en SUDINCO S.A. | Administración y dirección de empresas', NULL, NULL, 'https://www.linkedin.com/in/ing-javier-freire-r-0bb534a0/', 'LinkedIn', 'RPA', '1', '2026-08-27', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.990716');
INSERT INTO public.prospectos VALUES (46, '2026-08-27 22:00:55', 'construccion', 'Construcción e Inmobiliarias Grandes', 'SUDINCO.S.A', '1790258688001', 'https://gruposudinco.com/', 'Diego Fernando', 'Garzon Maya', 'https://www.linkedin.com/in/diegofgarzonmaya/', NULL, NULL, NULL, 'LinkedIn', 'RPA', '1', '2026-08-27', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.991289');
INSERT INTO public.prospectos VALUES (47, '2026-08-27 22:15:09', 'construccion', 'Construcción e Inmobiliarias Grandes', 'SUDINCO', '1790258688001', 'https://gruposudinco.com/', 'Tatiana', 'Murillo Zabala', 'Asistente CEO - SUDINCO', NULL, NULL, 'https://www.linkedin.com/in/tatiana-murillo-zabala-38182a159/', 'LinkedIn', 'RPA', '1', '2026-08-27', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.991838');
INSERT INTO public.prospectos VALUES (48, '2026-08-28 14:16:11', 'logistica', 'Logística y Transporte', 'SUDINCO.S.A', '1790258688001', 'https://www.linkedin.com/company/sudinco/?originalSubdomain=ec', 'Paula', 'Cañaz', 'Directora de Planificación en Sudinco', NULL, NULL, 'https://www.linkedin.com/in/paulacz/', 'LinkedIn', 'RPA', '1', '2026-08-28', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.992362');
INSERT INTO public.prospectos VALUES (49, '2026-08-28 18:55:18', 'salud', 'Salud, Farmacias y Laboratorios', 'Simed', '1790691810001', 'https://simedcorp.com/', 'Stefani', 'Polanco Aguilar', 'Master of Business Administration - MBA en ESPAE Graduate School of Management - ESPOL', NULL, NULL, 'https://www.linkedin.com/in/stefani-polanco-aguilar-48054196/', 'LinkedIn', 'RPA', '1', '2026-08-28', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.992728');
INSERT INTO public.prospectos VALUES (50, '2026-08-28 18:57:39', 'salud', 'Salud, Farmacias y Laboratorios', 'Simed', '1790691810001', 'https://simedcorp.com/', 'Santiago', 'Aguirre', 'Gerente general SIMED SA', NULL, NULL, 'https://www.linkedin.com/in/santiago-aguirre-038399149/', 'LinkedIn', 'RPA', '1', '2026-08-28', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.993064');
INSERT INTO public.prospectos VALUES (51, '2026-08-28 19:04:10', 'salud', 'Salud, Farmacias y Laboratorios', 'Grupo Difare', '0990858322001', 'http://www.grupodifare.com/', 'Zuani Katalina', 'Martínez Brito', 'administrador farmacia  en Grupo DIFARE', NULL, NULL, 'https://www.linkedin.com/in/zuani-katalina-mart%C3%ADnez-brito-80800a1a0/', 'LinkedIn', 'RPA', '1', '2026-08-28', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.993419');
INSERT INTO public.prospectos VALUES (52, '2026-08-28 19:09:15', 'salud', 'Salud, Farmacias y Laboratorios', 'Difare', '0990858322001', 'http://www.grupodifare.com/', 'Carlos', 'Cueva', 'GERENTE GENERAL en DIFARE S.A.', NULL, NULL, 'https://www.linkedin.com/in/carlos-cueva-47201b34/', 'LinkedIn', 'RPA', '1', '2026-08-28', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.993759');
INSERT INTO public.prospectos VALUES (53, '2026-08-28 19:16:20', 'agroindustria', 'Agroindustria, Acuacultura y Exportación', 'Nestle', '20263322496', 'https://www.nestle.com.ec/es', 'Josué', 'De La Maza', 'https://www.linkedin.com/in/josu%C3%A9-de-la-maza-00a9b221/', NULL, NULL, NULL, 'LinkedIn', 'RPA', '1', '2026-08-28', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.994091');
INSERT INTO public.prospectos VALUES (54, '2026-08-28 19:19:28', 'agroindustria', 'Agroindustria, Acuacultura y Exportación', 'Nestle', '20263322496', 'https://www.nestle.com.ec/es/info', 'Daniel', 'Martínez Gonzales', 'Head of Supply Chain Nestlé Ecuador | Transformando la eficiencia operativa en impacto positivo | Logística y Sostenibilidad', NULL, NULL, 'http://linkedin.com/in/daniel-mart%C3%ADnez-gonz%C3%A1lez-b798b767/', 'LinkedIn', 'RPA', '1', '2026-08-28', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.994418');
INSERT INTO public.prospectos VALUES (55, '2026-08-28 19:23:29', 'agroindustria', 'Agroindustria, Acuacultura y Exportación', 'Nestle', '20263322496', 'https://www.nestle.com.ec/es/info', 'Richard', 'Barrigas', 'Supervisor de ventas en Nestlé', NULL, NULL, 'http://linkedin.com/in/richard-barrigas-44654942b/', 'LinkedIn', 'RPA', '1', '2026-08-28', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.994737');
INSERT INTO public.prospectos VALUES (56, '2026-08-28 19:30:23', 'agroindustria', 'Agroindustria, Acuacultura y Exportación', 'Paccarri', '1791995112001', 'https://paccari.com/', 'Santiago', 'Peralta', 'Founder of Paccari Chocolate', NULL, NULL, 'https://www.linkedin.com/in/santiago-peralta-5a2838191/', 'LinkedIn', 'RPA', '1', '2026-08-28', NULL, NULL, NULL, NULL, '2026-08-30 18:43:57.995054');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES (3, 'María García', 'maria@example.com', '$2a$10$TNE5Ptsoah5gsnXFdhiA0uL2LmyoZHivaYmto.QX.GWxnI3tMwpUG', 'user', 1500, true, NULL, 'Digital Minds', '+593 97 654 3210', '2026-08-25 22:16:03.886266', '2026-08-25 22:16:03.886266', true, 'cliente', NULL, NULL, 0, 0, 0);
INSERT INTO public.users VALUES (1, 'Admin TuringTech', 'admin@turingtech.com.ec', '$2a$10$u7iCjA5premijQWZm1TgE.k9O3Kyriox4G//GA1FoOuu8qi1VBHWO', 'admin', 11000, true, NULL, 'TURINGTECH Ecuador', '+593 99 068 6162', '2026-08-25 22:16:03.692492', '2026-08-30 17:26:09.156025', true, 'colaborador', 'Administrador TURINGTECH', NULL, 10, 0, 0);
INSERT INTO public.users VALUES (5, 'Jhossua Vega', 'jhossua.vega@turingtech.com.ec', '$2a$10$j3FNMLxrbjWpHpq1YkFCEeX3jw5C2KJQuz/sqH1UGsss6GW9lMIlS', 'user', 20, true, NULL, 'TURINGTECH Ecuador', '0959720085', '2026-08-30 17:34:24.390522', '2026-08-30 18:12:14.468404', true, 'colaborador', 'Data Engineer & Analytics Specialist', 'data:image/jpeg;base64,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', 10, 0, 100);
INSERT INTO public.users VALUES (9, 'Leonel Parrales', 'leonel.parrales@turingtech.com.ec', '$2a$10$82lbrGknwaiECzV6/N9EBeQgxPMC.diD6Ptmg2fNh1LYt2JA7vhPG', 'user', 0, true, NULL, 'TURINGTECH Ecuador', NULL, '2026-08-30 19:03:53.173127', '2026-08-30 19:03:53.173127', true, 'colaborador', 'Cloud Data & Solutions Architect', NULL, 10, 0, 0);
INSERT INTO public.users VALUES (10, 'Nicole Flores', 'nicole.flores@turingtech.com.ec', '$2a$10$.dl9FTAxbKCMmrB3Z1GHau.KAByHnvO.W/ckUzXlcK0m0H3F44sOq', 'user', 0, true, NULL, 'TURINGTECH Ecuador', NULL, '2026-08-30 19:03:53.245664', '2026-08-30 19:03:53.245664', true, 'colaborador', 'Product Manager & Business Development Lead', NULL, 10, 0, 0);
INSERT INTO public.users VALUES (11, 'Wendy Juma', 'wendy.juma@turingtech.com.ec', '$2a$10$zB/pqb6WSaJshErrwx53t.4QaK/bdeylGqP1eceaPIXHhdGZ1YDY6', 'user', 0, true, NULL, 'TURINGTECH Ecuador', NULL, '2026-08-30 19:03:53.32402', '2026-08-30 19:03:53.32402', true, 'colaborador', 'QA Automation & Systems Engineer', NULL, 10, 0, 0);
INSERT INTO public.users VALUES (12, 'prox', 'prox@prox.com', '$2a$10$6XAaRiIvDnNItZXLle9ow.NVEFodax2m2Tvhxn.utG05ZLnS2SOxi', 'user', 0, true, NULL, 'TURINGTECH Ecuador', NULL, '2026-08-30 19:47:00.373443', '2026-08-30 19:47:00.373443', true, 'cliente', 'aa', NULL, 10, 0, 0);
INSERT INTO public.users VALUES (13, 'juan', 'prox@prox.com.ec', '$2a$10$76SIhi1gl.R6FnO86ODPseNS0qRz1dREjGpVRWn3fFSKPmibrGBQy', 'user', 0, false, '90a2ed6474480b844049c5fcfcb1567e0024c1662487b32405fe1b54e0b8d633', 'prox', '0987456123', '2026-08-30 19:47:40.877712', '2026-08-30 19:47:40.877712', true, 'cliente', NULL, NULL, 10, 0, 0);
INSERT INTO public.users VALUES (2, 'Carlos Mendoza', 'carlos@example.com', '$2a$10$W9HhF51rnEzxtzudTaFvpOIYpeizigkmc2Nsi/XmIiY8YXOK1ekBa', 'user', 3500, true, NULL, 'TechSolutions Inc', '+593 98 765 4321', '2026-08-25 22:16:03.804761', '2026-08-30 17:29:20.009985', true, 'cliente', NULL, NULL, 0, 0, 0);


--
-- Name: admin_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admin_config_id_seq', 2, true);


--
-- Name: board_projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.board_projects_id_seq', 5, true);


--
-- Name: board_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.board_tasks_id_seq', 38, true);


--
-- Name: credit_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.credit_requests_id_seq', 3, true);


--
-- Name: credit_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.credit_transactions_id_seq', 10, true);


--
-- Name: hr_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hr_requests_id_seq', 4, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 11, true);


--
-- Name: prospectos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.prospectos_id_seq', 57, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 13, true);


--
-- Name: admin_config admin_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_config
    ADD CONSTRAINT admin_config_key_key UNIQUE (key);


--
-- Name: admin_config admin_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_config
    ADD CONSTRAINT admin_config_pkey PRIMARY KEY (id);


--
-- Name: board_project_members board_project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_project_members
    ADD CONSTRAINT board_project_members_pkey PRIMARY KEY (project_id, user_id);


--
-- Name: board_projects board_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_projects
    ADD CONSTRAINT board_projects_pkey PRIMARY KEY (id);


--
-- Name: board_tasks board_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_tasks
    ADD CONSTRAINT board_tasks_pkey PRIMARY KEY (id);


--
-- Name: credit_requests credit_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_requests
    ADD CONSTRAINT credit_requests_pkey PRIMARY KEY (id);


--
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);


--
-- Name: hr_requests hr_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_requests
    ADD CONSTRAINT hr_requests_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: prospectos prospectos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospectos
    ADD CONSTRAINT prospectos_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_board_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_board_estado ON public.board_tasks USING btree (estado);


--
-- Name: idx_board_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_board_project_id ON public.board_tasks USING btree (project_id);


--
-- Name: idx_hr_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_requests_status ON public.hr_requests USING btree (status);


--
-- Name: idx_hr_requests_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hr_requests_user ON public.hr_requests USING btree (user_id);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_prospectos_sector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospectos_sector ON public.prospectos USING btree (sector_id);


--
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_status ON public.credit_requests USING btree (status);


--
-- Name: idx_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_user_id ON public.credit_requests USING btree (user_id);


--
-- Name: idx_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_user_id ON public.credit_transactions USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: board_project_members board_project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_project_members
    ADD CONSTRAINT board_project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.board_projects(id) ON DELETE CASCADE;


--
-- Name: board_project_members board_project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_project_members
    ADD CONSTRAINT board_project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: board_projects board_projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_projects
    ADD CONSTRAINT board_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: board_tasks board_tasks_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_tasks
    ADD CONSTRAINT board_tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id);


--
-- Name: board_tasks board_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_tasks
    ADD CONSTRAINT board_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: board_tasks board_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_tasks
    ADD CONSTRAINT board_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.board_projects(id);


--
-- Name: credit_requests credit_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_requests
    ADD CONSTRAINT credit_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: credit_requests credit_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_requests
    ADD CONSTRAINT credit_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: credit_transactions credit_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: hr_requests hr_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_requests
    ADD CONSTRAINT hr_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: hr_requests hr_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_requests
    ADD CONSTRAINT hr_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: prospectos prospectos_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospectos
    ADD CONSTRAINT prospectos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 12Z7XF3gIJuiZARPc89Z7RBWdg8h7lINPW25cGLZrezHRs2McFRcD3fqIq8iX49


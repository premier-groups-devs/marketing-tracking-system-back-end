-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 05-02-2025 a las 03:41:54
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `db-marketing-tracking-system`
--

DELIMITER $$
--
-- Procedimientos
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `GetMarketingDashboardData` (IN `startDate` DATE, IN `endDate` DATE)   BEGIN
	SELECT 
    mc.source_name,
    COUNT(DISTINCT jc.id) AS leads,
    SUM(CASE WHEN mcs.status_name = 'Appointment Valid' THEN 1 ELSE 0 END) AS appointments,
    ROUND((SUM(CASE WHEN mcs.status_name = 'Appointment Valid' THEN 1 ELSE 0 END) / COUNT(DISTINCT jc.id)) * 100, 2) AS `porc_appointments`,
    SUM(CASE WHEN mcs.status_name = 'Demo Valid' THEN 1 ELSE 0 END) AS demos,
    IFNULL(ROUND((SUM(CASE WHEN mcs.status_name = 'Demo Valid' THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN mcs.status_name = 'Appointment Valid' THEN 1 ELSE 0 END), 0)) * 100, 2), 0.00) AS `porc_demos`,
    IFNULL(sales_data.sales, 0) AS sales,
    IFNULL(ROUND((IFNULL(sales_data.sales, 0) /  NULLIF(SUM(CASE WHEN mcs.status_name = 'Appointment Valid' THEN 1 ELSE 0 END), 0)) * 100, 2), 0.00) AS `porc_sales`,
    IFNULL(ROUND((IFNULL(sales_data.sales, 0) / NULLIF(SUM(CASE WHEN mcs.status_name = 'Demo Valid' THEN 1 ELSE 0 END), 0)) * 100, 2), 0.00) AS `demo_effectivity`,
    FORMAT(IFNULL(revenue_data.total_revenue, 0), 2) AS revenue, 
    FORMAT(IFNULL(mcs_spend.total_amount, 0), 2) AS cost,
    FORMAT(IFNULL(mcs_spend.total_amount, 0) / COUNT(DISTINCT jc.id), 2) AS `cost_leads`,
    FORMAT(IFNULL(mcs_spend.total_amount, 0) / IFNULL(NULLIF(sales_data.sales, 0), 1), 2) AS `cost_sales`,
    ROUND(((IFNULL(revenue_data.total_revenue, 0) - IFNULL(mcs_spend.total_amount, 0)) / IFNULL(mcs_spend.total_amount, 1)) * 100, 2) AS `porc_roi`,
    IFNULL(ROUND((COUNT(DISTINCT jc.id) / NULLIF(total_leads.total_leads, 0)) * 100, 2), 0.00) AS `leads_effectivity`,
    IFNULL(ROUND((SUM(CASE WHEN mcs.status_name = 'Appointment Valid' THEN 1 ELSE 0 END) / NULLIF((SELECT SUM(CASE WHEN status_name = 'Appointment Valid' THEN 1 ELSE 0 END) FROM jobnimbus_contacts_status_historicals), 0)) * 100, 2), 0.00) AS `lead_source_effectivity_set_appointments`,
    IFNULL(ROUND((SUM(CASE WHEN mcs.status_name = 'Demo Valid' THEN 1 ELSE 0 END) / NULLIF((SELECT SUM(CASE WHEN status_name = 'Demo Valid' THEN 1 ELSE 0 END) FROM jobnimbus_contacts_status_historicals), 0)) * 100, 2), 0.00) AS `lead_source_effectivity_demo`,
    IFNULL(ROUND((IFNULL(sales_data.sales, 0) / NULLIF((SELECT SUM(CASE WHEN status_name = 'Signed Contract' THEN 1 ELSE 0 END) FROM jobnimbus_contacts_status_historicals), 0)) * 100, 2), 0.00) AS `lead_source_effectivity_sales`,
    SUM(CASE WHEN mcs.status_name = 'Invalid' THEN 1 ELSE 0 END) AS `invalid`,
    SUM(CASE WHEN mcs.status_name = 'Unresponsive' THEN 1 ELSE 0 END) AS `unresponsive`,
    SUM(CASE WHEN mcs.status_name = 'Lost Sales' THEN 1 ELSE 0 END) AS `lost_sales`
FROM 
    jobnimbus_contacts jc
    INNER JOIN marketing_channels mc ON jc.source_name = mc.source_name
    LEFT JOIN (
        SELECT 
            id_marketing_channels, 
            SUM(amount) AS total_amount
        FROM 
            marketing_channel_spend
        GROUP BY 
            id_marketing_channels
    ) mcs_spend ON mc.id = mcs_spend.id_marketing_channels
    LEFT JOIN (
        SELECT 
            id_jobnimbus_contacts,
            status_name,
            MAX(date_create) AS last_status_date
        FROM 
            jobnimbus_contacts_status_historicals
        WHERE 
            is_active = 1
        GROUP BY 
            id_jobnimbus_contacts, status_name
    ) mcs ON jc.id = mcs.id_jobnimbus_contacts
    LEFT JOIN (
        SELECT 
            jc.source_name,
            SUM(CASE WHEN jcs.status_name = 'Signed Contract' THEN 1 ELSE 0 END) AS sales
        FROM 
            jobnimbus_contacts jc
            INNER JOIN jobnimbus_contacts_status_historicals jcs ON jc.id = jcs.id_jobnimbus_contacts
        WHERE 
            jcs.status_name = 'Signed Contract'
        GROUP BY 
            jc.source_name
    ) sales_data ON jc.source_name = sales_data.source_name
    LEFT JOIN (
        SELECT source_name, SUM(cf_double_5) AS total_revenue
        FROM jobnimbus_contacts
        WHERE cf_double_5 > 0
        GROUP BY source_name
    ) revenue_data ON jc.source_name = revenue_data.source_name
    CROSS JOIN (
        SELECT COUNT(*) AS total_leads 
        FROM jobnimbus_contacts jc
        INNER JOIN marketing_channels mc ON jc.source_name = mc.source_name
        WHERE jc.source_name IS NOT NULL AND mc.is_active = 1
    ) total_leads
WHERE 
    jc.source_name IS NOT NULL
    AND mc.is_active=1
GROUP BY 
    mc.source_name
ORDER BY 
    leads DESC;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `city`
--

CREATE TABLE `city` (
  `id_city` int(11) NOT NULL,
  `id_location_jobnimbus` int(11) DEFAULT NULL,
  `city_name` varchar(255) DEFAULT NULL,
  `state_code` varchar(2) DEFAULT NULL,
  `is_active` int(11) DEFAULT 1,
  `colors_charts` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `city`
--

INSERT INTO `city` (`id_city`, `id_location_jobnimbus`, `city_name`, `state_code`, `is_active`, `colors_charts`) VALUES
(1, 1, 'Bloomingdale', 'IL', 1, 'rgb(45, 81, 87, 1)'),
(2, 11, 'Miami', 'FL', 1, 'rgb(255, 127, 14)'),
(3, 14, 'Nationwide', '', 1, 'rgb(214, 39, 40)'),
(4, 16, 'Milwaukee', 'WI', 1, 'rgb(44, 160, 44)'),
(5, 17, 'Houston', 'TX', 1, 'rgb(148, 103, 189)'),
(6, 18, 'Arlington', 'VA', 1, 'rgb(140, 86, 75)');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `company`
--

CREATE TABLE `company` (
  `id_company` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `company`
--

INSERT INTO `company` (`id_company`, `name`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Tech Innovations', 1, '2024-11-01 20:44:32', NULL),
(2, 'Health Solutions', 1, '2024-11-01 20:44:32', NULL),
(3, 'Finance Corp', 1, '2024-11-01 20:44:32', NULL),
(4, 'Creative Agency', 1, '2024-11-01 20:44:32', NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `jobnimbus_contacts`
--

CREATE TABLE `jobnimbus_contacts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `first_name` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `home_phone` varchar(50) DEFAULT NULL,
  `mobile_phone` varchar(50) DEFAULT NULL,
  `address_line1` varchar(255) DEFAULT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state_text` varchar(100) DEFAULT NULL,
  `zip` varchar(20) DEFAULT NULL,
  `company` varchar(255) DEFAULT NULL,
  `country_name` varchar(100) DEFAULT NULL,
  `approved_estimate_total` decimal(10,2) DEFAULT NULL,
  `approved_invoice_total` decimal(10,2) DEFAULT NULL,
  `last_estimate` varchar(255) DEFAULT NULL,
  `approved_invoice_due` decimal(10,2) DEFAULT NULL,
  `status_name` varchar(100) DEFAULT NULL,
  `cf_string_10` varchar(255) DEFAULT NULL,
  `sales_rep_name` varchar(255) DEFAULT NULL,
  `sales_rep` varchar(255) DEFAULT NULL,
  `record_type_name` varchar(100) DEFAULT NULL,
  `source_name` varchar(255) DEFAULT NULL,
  `source` varchar(255) DEFAULT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `date_created` bigint(20) DEFAULT NULL,
  `date_updated` bigint(20) DEFAULT NULL,
  `cf_string_24` varchar(255) DEFAULT NULL,
  `jnid` varchar(255) DEFAULT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `cf_string_26` varchar(255) DEFAULT NULL,
  `last_estimate_date_created` bigint(20) DEFAULT NULL,
  `last_estimate_date_estimate` bigint(20) DEFAULT NULL,
  `last_estimate_jnid` varchar(255) DEFAULT NULL,
  `last_estimate_number` varchar(255) DEFAULT NULL,
  `last_invoice` varchar(255) DEFAULT NULL,
  `last_invoice_date_created` bigint(20) DEFAULT NULL,
  `last_invoice_date_invoice` bigint(20) DEFAULT NULL,
  `last_invoice_jnid` varchar(255) DEFAULT NULL,
  `last_invoice_number` varchar(255) DEFAULT NULL,
  `cf_date_6` bigint(20) DEFAULT NULL,
  `cf_string_53` varchar(255) DEFAULT NULL,
  `cf_string_54` varchar(255) DEFAULT NULL,
  `cf_double_1` double DEFAULT NULL,
  `cf_double_19` double DEFAULT NULL,
  `cf_double_8` double DEFAULT NULL,
  `cf_string_15` varchar(255) DEFAULT NULL,
  `cf_double_5` double NOT NULL,
  `cf_string_61` varchar(255) NOT NULL,
  `cf_boolean_11` double NOT NULL,
  `cf_date_7` bigint(20) NOT NULL,
  `date_create` datetime NOT NULL DEFAULT current_timestamp(),
  `date_update` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `jobnimbus_contacts`
--

INSERT INTO `jobnimbus_contacts` (`id`, `first_name`, `last_name`, `email`, `phone`, `home_phone`, `mobile_phone`, `address_line1`, `address_line2`, `city`, `state_text`, `zip`, `company`, `country_name`, `approved_estimate_total`, `approved_invoice_total`, `last_estimate`, `approved_invoice_due`, `status_name`, `cf_string_10`, `sales_rep_name`, `sales_rep`, `record_type_name`, `source_name`, `source`, `tags`, `location`, `date_created`, `date_updated`, `cf_string_24`, `jnid`, `display_name`, `cf_string_26`, `last_estimate_date_created`, `last_estimate_date_estimate`, `last_estimate_jnid`, `last_estimate_number`, `last_invoice`, `last_invoice_date_created`, `last_invoice_date_invoice`, `last_invoice_jnid`, `last_invoice_number`, `cf_date_6`, `cf_string_53`, `cf_string_54`, `cf_double_1`, `cf_double_19`, `cf_double_8`, `cf_string_15`, `cf_double_5`, `cf_string_61`, `cf_boolean_11`, `cf_date_7`, `date_create`, `date_update`) VALUES
(1, 'Ronny', 'Testing QA', 'system@premierchi.com', 'null', '5199335003x1', '9935003145x5555878', 'null', 'null', NULL, 'UT', 'null', NULL, 'United States', 0.00, 0.00, '0', 0.00, 'Signed Contract', 'Commercial', 'null', 'null', 'Commercial', 'Google Organic', '19', '[]', '{\"id\":11}', 1731703899, 20250204203709, 'null', 'm3j7sg8dy3hkb13ej5obpbc', 'Ronny Testing QA', 'null', 0, 0, 'null', 'null', '0', 0, 0, 'null', 'null', 0, 'Commercial', '00000001', 0, 0, 0, 'null', 1500, 'Commercial Shingle', 1, 1738688400, '2024-11-15 20:51:39', '2025-02-04 20:28:28'),
(2, 'Daniel', 'Testing QA', 'daniel@premierchi.com', NULL, '51998785x1', NULL, NULL, NULL, NULL, 'UT', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Appointment Valid', 'Commercial', NULL, NULL, 'Commercial', 'Webrunner - Bing Paid', '20', NULL, '{\"id\":11}', NULL, NULL, NULL, 'm3j7sg8dy3hkb13ej5obpbg', 'Daniel Testing QA', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Commercial', NULL, NULL, NULL, NULL, NULL, 500, 'Commercial Shingle', 1, 1738688400, '2025-02-04 20:51:37', '2025-02-04 20:51:37'),
(3, 'Mirella', 'Testing QA', ',mirella@premierchi.com', 'null', '5199335003x1', '9935003145x5555878', 'null', 'null', NULL, 'UT', 'null', NULL, 'United States', 0.00, 0.00, '0', 0.00, 'Signed Contract', 'Commercial', 'null', 'null', 'Commercial', 'Google Organic', '19', '[]', '{\"id\":11}', 1731703899, 20250204203709, 'null', 'm3j7sg8dy3hkb13ej5obpbp', 'Mirella Testing QA', 'null', 0, 0, 'null', 'null', '0', 0, 0, 'null', 'null', 0, 'Commercial', '00000001', 0, 0, 0, 'null', 2500, 'Commercial Shingle', 1, 1738688400, '2024-11-15 20:51:39', '2025-02-04 20:28:28'),
(4, 'Fernanda', 'Testing QA', 'Fernanda@premierchi.com', 'null', '5199335003x1', '9935003145x5555878', 'null', 'null', NULL, 'UT', 'null', NULL, 'United States', 0.00, 0.00, '0', 0.00, 'Signed Contract', 'Commercial', 'null', 'null', 'Commercial', 'Webrunner - Bing Paid', '19', '[]', '{\"id\":11}', 1731703899, 20250204203709, 'null', 'm3j7sg8dy3hkb13ej5obpbm', 'Fernanda Testing QA', 'null', 0, 0, 'null', 'null', '0', 0, 0, 'null', 'null', 0, 'Commercial', '00000001', 0, 0, 0, 'null', 1000, 'Commercial Shingle', 1, 1738688400, '2024-11-15 20:51:39', '2025-02-04 20:28:28');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `jobnimbus_contacts_status_historicals`
--

CREATE TABLE `jobnimbus_contacts_status_historicals` (
  `id` int(11) NOT NULL,
  `id_jobnimbus_contacts` int(11) NOT NULL,
  `status_name` varchar(100) NOT NULL,
  `is_active` int(11) NOT NULL DEFAULT 1,
  `date_create` datetime NOT NULL DEFAULT current_timestamp(),
  `date_update` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `jobnimbus_contacts_status_historicals`
--

INSERT INTO `jobnimbus_contacts_status_historicals` (`id`, `id_jobnimbus_contacts`, `status_name`, `is_active`, `date_create`, `date_update`) VALUES
(18, 1, 'Fresh lead', 1, '2025-02-04 20:29:28', '2025-02-04 20:29:28'),
(19, 1, 'Appointment Valid', 1, '2025-02-04 20:30:28', '2025-02-04 20:30:28'),
(20, 1, 'Demo Valid', 1, '2025-02-04 20:32:28', '2025-02-04 20:32:28'),
(21, 1, 'Signed Contract', 1, '2025-02-04 20:37:09', '2025-02-04 20:37:09'),
(22, 2, 'Fresh lead', 1, '2025-02-04 20:55:03', '2025-02-04 20:55:03'),
(23, 2, 'Appointment Valid', 1, '2025-02-04 20:55:29', '2025-02-04 20:55:29'),
(24, 2, 'Demo Valid', 1, '2025-02-04 20:57:24', '2025-02-04 20:57:24'),
(25, 2, 'Signed Contract', 1, '2025-02-04 20:58:22', '2025-02-04 20:58:22'),
(26, 3, 'Fresh lead', 1, '2025-02-04 21:01:51', '2025-02-04 21:01:51'),
(27, 3, 'Appointment Valid', 1, '2025-02-04 21:01:51', '2025-02-04 21:01:51'),
(28, 3, 'Demo Valid', 1, '2025-02-04 21:01:51', '2025-02-04 21:01:51'),
(29, 3, 'Signed Contract', 1, '2025-02-04 21:01:58', '2025-02-04 21:01:58'),
(30, 4, 'Fresh lead', 1, '2025-02-04 21:12:36', '2025-02-04 21:12:36'),
(31, 4, 'Appointment Valid', 1, '2025-02-04 21:12:36', '2025-02-04 21:12:36'),
(32, 4, 'Demo Valid', 1, '2025-02-04 21:12:36', '2025-02-04 21:12:36'),
(33, 4, 'Signed Contract', 1, '2025-02-04 21:12:36', '2025-02-04 21:12:36');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `marketing_channels`
--

CREATE TABLE `marketing_channels` (
  `id` int(11) NOT NULL,
  `source_name` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `url` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `marketing_channels`
--

INSERT INTO `marketing_channels` (`id`, `source_name`, `is_active`, `url`) VALUES
(1, 'Webrunner - Google Paid', 1, 'https://media.licdn.com/dms/image/v2/C4E0BAQHD1_WT3aXeWQ/company-logo_200_200/company-logo_200_200/0/1638284709492/webrunner_media_group_logo?e=2147483647&v=beta&t=fmIIIHADPMrZ4Wx_Vq8ozxUFIbKZ_nMOqJJft2FjhTs'),
(2, 'Google Organic', 1, 'http://example.com/google-organic'),
(3, 'Angi Leads', 1, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQb4SLVrp65A3J4RMwctEx1bjweDdc7bP5G7QT6NkqQ_etnBnX1VchXe-oYDGb3q7AJtqE&usqp=CAU'),
(4, 'Homebuddy', 1, 'https://d2q79iu7y748jz.cloudfront.net/s/_squarelogo/256x256/658437ba9f5dc50e929c16096b406eac'),
(5, 'Webrunner - Bing Paid', 1, 'http://example.com/webrunner-bing-paid'),
(6, NULL, 0, NULL),
(7, 'Referral', 1, 'http://example.com/referral'),
(8, 'Roofle', 1, 'https://offers.roofle.com/hubfs/ROOFLE/Logos/ROOFLE%C2%AE/Roofle_light.svg'),
(9, 'Webrunner - Facebook Paid', 1, 'https://media.licdn.com/dms/image/v2/C4E0BAQHD1_WT3aXeWQ/company-logo_200_200/company-logo_200_200/0/1638284709492/webrunner_media_group_logo?e=2147483647&v=beta&t=fmIIIHADPMrZ4Wx_Vq8ozxUFIbKZ_nMOqJJft2FjhTs'),
(10, 'Karma Callrail', 1, 'http://example.com/karma-callrail'),
(11, 'Webrunner - Unknown Paid', 1, 'https://media.licdn.com/dms/image/v2/C4E0BAQHD1_WT3aXeWQ/company-logo_200_200/company-logo_200_200/0/1638284709492/webrunner_media_group_logo?e=2147483647&v=beta&t=fmIIIHADPMrZ4Wx_Vq8ozxUFIbKZ_nMOqJJft2FjhTs'),
(12, 'Cold Calls', 1, 'http://example.com/cold-calls'),
(13, 'Yelp Leads', 1, 'http://example.com/yelp-leads'),
(14, 'GMB', 1, 'http://example.com/gmb'),
(15, 'Yellow Pages', 1, 'http://example.com/yellow-pages'),
(16, 'Existing Customer', 0, 'http://example.com/existing-customer'),
(17, 'Direct Email Marketing', 1, 'http://example.com/direct-email-marketing'),
(18, 'Calls - Direct', 1, 'http://example.com/calls-direct'),
(19, 'Local Service Ads', 1, 'http://example.com/local-service-ads'),
(20, 'Yard Signs', 1, 'http://example.com/yard-signs'),
(21, 'Bing Organic', 1, 'http://example.com/bing-organic'),
(22, 'GTR', 1, 'http://example.com/gtr');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `marketing_channel_spend`
--

CREATE TABLE `marketing_channel_spend` (
  `id` int(11) NOT NULL,
  `amount` double NOT NULL,
  `id_marketing_channels` int(11) NOT NULL,
  `register_date` datetime NOT NULL,
  `is_active` int(11) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `marketing_channel_spend`
--

INSERT INTO `marketing_channel_spend` (`id`, `amount`, `id_marketing_channels`, `register_date`, `is_active`) VALUES
(1, 50, 2, '2025-01-27 18:20:02', 1),
(2, 250, 5, '2025-01-27 18:20:02', 1),
(3, 350, 7, '2025-01-27 19:08:42', 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `menu`
--

CREATE TABLE `menu` (
  `id_menu` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  `icon` varchar(50) DEFAULT NULL,
  `order_index` int(11) DEFAULT NULL,
  `is_active` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `menu`
--

INSERT INTO `menu` (`id_menu`, `name`, `description`, `url`, `icon`, `order_index`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'dashboard', NULL, NULL, 'dashboard', 1, 1, '2024-11-11 14:44:10', '2024-11-11 14:44:10');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `month`
--

CREATE TABLE `month` (
  `id_month` int(11) NOT NULL,
  `month_name` varchar(45) DEFAULT NULL,
  `is_active` int(11) DEFAULT 1,
  `colors_charts_appointments` text DEFAULT NULL,
  `colors_charts_sales` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `month`
--

INSERT INTO `month` (`id_month`, `month_name`, `is_active`, `colors_charts_appointments`, `colors_charts_sales`) VALUES
(1, 'January', 1, 'rgb(45, 81, 87, 1)', 'rgb(255, 127, 14)'),
(2, 'February', 1, 'rgb(45, 81, 87, 1)', 'rgb(255, 127, 14)'),
(3, 'March', 1, 'rgb(45, 81, 87, 1)', 'rgb(255, 127, 14)'),
(4, 'April', 1, 'rgb(45, 81, 87, 1)', 'rgb(255, 127, 14)'),
(5, 'May', 1, 'rgb(45, 81, 87, 1)', 'rgb(255, 127, 14)'),
(6, 'June', 1, 'rgb(45, 81, 87, 1)', 'rgb(255, 127, 14)'),
(7, 'July', 1, 'rgb(45, 81, 87, 1)', 'rgb(255, 127, 14)'),
(8, 'August', 1, 'rgb(45, 81, 87, 1)', 'rgb(255, 127, 14)'),
(9, 'September', 1, 'rgb(45, 81, 87, 1)', 'rgb(255, 127, 14)'),
(10, 'October', 1, 'rgb(45, 81, 87, 1)', 'rgb(255, 127, 14)'),
(11, 'November', 1, 'rgb(45, 81, 87, 1)', 'rgb(255, 127, 14)'),
(12, 'December', 1, 'rgb(45, 81, 87, 1)', 'rgb(255, 127, 14)');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `service_required`
--

CREATE TABLE `service_required` (
  `id` int(11) NOT NULL,
  `description` varchar(255) NOT NULL,
  `is_active` int(11) NOT NULL DEFAULT 1,
  `date_create` datetime NOT NULL DEFAULT current_timestamp(),
  `date_update` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `service_required`
--

INSERT INTO `service_required` (`id`, `description`, `is_active`, `date_create`, `date_update`) VALUES
(1, 'Commercial Flat Roof', 1, '2025-02-04 18:13:38', '2025-02-04 18:13:38'),
(2, 'Commercial Shingle', 1, '2025-02-04 18:13:38', '2025-02-04 18:13:38'),
(3, 'Residential Claims', 1, '2025-02-04 18:13:38', '2025-02-04 18:13:38'),
(4, 'Residential Metal Roofing', 1, '2025-02-04 18:13:38', '2025-02-04 18:13:38'),
(5, 'Residential Metal y Clay tiles', 1, '2025-02-04 18:13:38', '2025-02-04 18:13:38'),
(6, 'Residential Roofing', 1, '2025-02-04 18:13:38', '2025-02-04 18:13:38'),
(7, 'Residential Shingle', 1, '2025-02-04 18:13:38', '2025-02-04 18:13:38'),
(8, 'Residential Tile', 1, '2025-02-04 18:13:38', '2025-02-04 18:13:38'),
(9, 'Siding', 1, '2025-02-04 18:13:38', '2025-02-04 18:13:38'),
(10, 'Siding & Masonry', 1, '2025-02-04 18:13:38', '2025-02-04 18:13:38');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `users`
--

CREATE TABLE `users` (
  `id_user` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `birthday` date NOT NULL,
  `id_company` int(11) DEFAULT NULL,
  `id_state` int(11) DEFAULT NULL,
  `id_city` int(11) DEFAULT NULL,
  `zip_code` varchar(20) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  `cf_string_54` int(11) DEFAULT NULL,
  `is_active` tinyint(4) DEFAULT 1,
  `id_role` int(11) DEFAULT NULL,
  `is_password` tinyint(4) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `users`
--

INSERT INTO `users` (`id_user`, `name`, `last_name`, `birthday`, `id_company`, `id_state`, `id_city`, `zip_code`, `phone`, `email`, `address`, `password`, `username`, `cf_string_54`, `is_active`, `id_role`, `is_password`, `created_at`, `updated_at`) VALUES
(1, 'Ronny', 'Simosa', '1990-01-01', 1, 1, 1, NULL, '51993350031', 'rjsimosa@gmail.com', NULL, '$2y$10$cTSbVA/sSis2i659oKQG1earyHESns4KwGP1XcfHedVhhF6bIQju.', 'rjsimosa', NULL, 1, 1, 0, '2024-11-01 20:57:34', '2025-01-23 15:27:56'),
(2, 'Daniel', 'Agusto', '1990-01-01', 1, 1, 1, NULL, '51993350038', 'daniel@gmail.com', NULL, '$2b$12$5ix0yZ/XFQijp/spB/uOWuUt2VcPAZv0lDOi25oaMPzfr4TP0tJwO', 'dagusto', NULL, 1, 2, 0, '2024-11-01 20:57:34', '2024-11-02 01:20:45');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `city`
--
ALTER TABLE `city`
  ADD PRIMARY KEY (`id_city`);

--
-- Indices de la tabla `company`
--
ALTER TABLE `company`
  ADD PRIMARY KEY (`id_company`);

--
-- Indices de la tabla `jobnimbus_contacts`
--
ALTER TABLE `jobnimbus_contacts`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `jobnimbus_contacts_status_historicals`
--
ALTER TABLE `jobnimbus_contacts_status_historicals`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `marketing_channels`
--
ALTER TABLE `marketing_channels`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `marketing_channel_spend`
--
ALTER TABLE `marketing_channel_spend`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `menu`
--
ALTER TABLE `menu`
  ADD PRIMARY KEY (`id_menu`);

--
-- Indices de la tabla `month`
--
ALTER TABLE `month`
  ADD PRIMARY KEY (`id_month`);

--
-- Indices de la tabla `service_required`
--
ALTER TABLE `service_required`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id_user`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `city`
--
ALTER TABLE `city`
  MODIFY `id_city` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `company`
--
ALTER TABLE `company`
  MODIFY `id_company` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `jobnimbus_contacts`
--
ALTER TABLE `jobnimbus_contacts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `jobnimbus_contacts_status_historicals`
--
ALTER TABLE `jobnimbus_contacts_status_historicals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT de la tabla `marketing_channels`
--
ALTER TABLE `marketing_channels`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT de la tabla `marketing_channel_spend`
--
ALTER TABLE `marketing_channel_spend`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `menu`
--
ALTER TABLE `menu`
  MODIFY `id_menu` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `month`
--
ALTER TABLE `month`
  MODIFY `id_month` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT de la tabla `service_required`
--
ALTER TABLE `service_required`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT de la tabla `users`
--
ALTER TABLE `users`
  MODIFY `id_user` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

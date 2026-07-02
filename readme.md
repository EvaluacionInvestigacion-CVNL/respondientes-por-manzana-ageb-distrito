# Percepción ciudadana en distritos

Asignación de distrito electoral a los respondientes de la Encuesta de Adaptación a la Violencia (EAV), a partir de su ubicación geográfica, usando el Marco Geoestadístico 2020 del INEGI.

## Resumen

- La asignación se realiza a **nivel manzana** (no al punto exacto del domicilio).
- En caso de traslape entre dos o más distritos, se usa el criterio de **mayor área** de intersección.
- Se asume que el Marco Geoestadístico 2020 es consistente con los datos de la EAV.

## Insumos

Marco Geoestadístico 2020 (INEGI):

- Shapefile de manzanas
- Shapefile de AGEB
- Shapefile de distritos

La asignación de distrito se realizó a nivel manzana, por ser la unidad geográfica más desagregada disponible.

## Metodología

### 1. Construcción del identificador geográfico

Para cada respondiente se construyó un identificador único (`cvegeo_cvnl`) a partir de la concatenación de variables geográficas:

| Variable  | Dígitos |
|-----------|---------|
| Entidad   | 2       |
| Municipio | 3       |
| Localidad | 4       |
| AGEB      | 4       |
| Manzana   | 3       |

El identificador completo tiene **16 dígitos** y permite vincular cada respondiente con las unidades geográficas del marco estadístico.

#### 1.1 Ajuste de valores de localidad

Se identificaron **36 respondientes** cuyo valor en la variable de localidad (`loc_mv`) era igual a `0`. De acuerdo con los criterios del INEGI, las localidades deben tener valores entre `1` y `9999`, por lo que estos registros se consideraron inconsistentes.

Para su corrección, se realizó un análisis utilizando las variables restantes (entidad, municipio, AGEB y manzana). Se observó que, al fijar estas cuatro variables, únicamente existía una localidad posible en todos los casos, correspondiente al valor `1`.

Con base en esto, se recodificaron todos los valores de `loc_mv = 0` a `loc_mv = 1`.

### 2. Asignación de distritos a manzanas

Se realizó un cruce espacial entre las manzanas con respondientes y los distritos. Para cada manzana se identificaron los distritos que la intersectan. En los casos donde una manzana intersecta más de un distrito:

1. Se calculó el área de intersección entre la manzana y cada distrito.
2. Se asignó como distrito único aquel con **mayor área de intersección**.

### 3. Exportación de resultados

Se generó un archivo en formato CSV con:

- Identificador del respondiente
- Clave geográfica
- Distrito asignado

### 4. Generación de tabulados

El código de análisis de la EAV fue ajustado para generar tabulados con base en la nueva variable de distrito. Se estandarizó la salida para que todas las variables incluyan únicamente:

- Respuestas generales
- Respuestas por distrito


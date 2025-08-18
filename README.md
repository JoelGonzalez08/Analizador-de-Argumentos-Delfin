# Analizador de Argumentos en Textos Académicos

Este repositorio contiene la implementación de una herramienta web interactiva diseñada para **identificar premisas y conclusiones** en textos académicos utilizando modelos de procesamiento de lenguaje natural (PLN) e inteligencia artificial.

Este proyecto se desarrolla en el marco del **Programa Delfín** como parte de una estancia de investigación, en colaboración con el investigador **Jesús Miguel García Gorrostieta**, especialista en PLN y minería de argumentación.

---

## 📓 Corpus de entrenamiento

El modelo CRF utilizado fue entrenado previamente (no incluido en este repositorio) usando el **Corpus de Argumentos de Tesis y Propuestas de Investigación (CATyPI)**, elaborado por Jesús Miguel García Gorrostieta y Aurelio López López (2020).

Este corpus está compuesto por secciones altamente argumentativas de tesis en el área de tecnologías de la información, anotadas manualmente con etiquetas para componentes argumentativos: premisas, conclusiones y otros.

> Referencia: García-Gorrostieta, J. M., y López-López, A. (2020). **Corpus en español de tesis: Argument corpus development**. [https://www.researchgate.net/publication/355021044_Argument_corpus_development_and_argument_component_classification_A_study_in_academic_Spanish](https://www.researchgate.net/publication/355021044_Argument_corpus_development_and_argument_component_classification_A_study_in_academic_Spanish)

---

## 🚀 Tecnologías utilizadas

### Backend (API)

* [FastAPI](https://fastapi.tiangolo.com/) para construir la API REST.
* Modelo CRF previamente entrenado con [sklearn-crfsuite](https://github.com/TeamHG-Memex/sklearn-crfsuite).
* Procesamiento lingüístico con [spaCy](https://spacy.io/) (modelo `es_core_news_sm`).
* Generación de sugerencias argumentativas mediante [OpenAI GPT-3.5 Turbo](https://platform.openai.com/).

### Frontend (Web)

* Interfaz desarrollada en HTML, CSS y JavaScript.
* Edición de texto tipo editor enriquecido.
* Vista lateral de sugerencias automáticas generadas por la IA.

---

## ⚖️ Estructura del repositorio

```
├── app.py                # API principal con rutas /predict y /recommend
└── crf_model.pkl         # Modelo CRF entrenado (no incluido)
└── main.html            # Interfaz web (editor + sugerencias)
├── .env                  # Archivo con variables de entorno (no incluido)
├── requirements.txt      # Lista de librerías necesarias
└── README.md
```

---

## 📆 Instalación y uso

1. **Clonar el repositorio:**

```bash
git clone https://github.com/JoelGonzalez08/Analizador-de-Argumentos-Delfin.git
```

2. **Crear entorno virtual:**

```bash
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

3. **Instalar dependencias:**

```bash
pip install -r requirements.txt
```

4. **Configurar la clave de OpenAI:**

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```env
API_KEY=tu_clave_de_api_aqui
```

5. **Ejecutar la API:**

```bash
uvicorn api.app:app --reload
```

6. **Abrir la herramienta:**

Abre el archivo `main.html` en tu navegador.

---

## ⚙️ Funcionamiento

1. El usuario redacta un texto argumentativo en el editor.
2. Al presionar "Analizar":

   * Se envía el texto a la ruta `/predict`, donde el modelo CRF etiqueta las palabras como `B-P`, `I-P`, `B-C`, `I-C` u `O`.
   * Las palabras clasificadas como premisas (azul) y conclusiones (naranja) son resaltadas en el texto.
3. Luego, estas secuencias son enviadas a la ruta `/recommend`.

   * GPT-3.5 genera sugerencias para mejorar cada premisa y conclusión detectada.
   * Las sugerencias se muestran en un panel lateral.

---

## 🌟 Contribuciones y contacto

Este proyecto es parte de una investigación colaborativa en el Programa Delfín. Para consultas o sugerencias:

**Contacto:**

* Autor estudiante: Joel David González Barros
* Investigador: Dr. Jesús Miguel García Gorrostieta

---

## ⚖️ Licencia

Este repositorio tiene fines académicos y de investigación. Consulta el archivo LICENSE para más información.

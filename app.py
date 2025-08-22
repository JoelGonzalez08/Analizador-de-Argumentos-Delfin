# main.py
from fastapi import FastAPI, HTTPException, Depends, Header, status
from openai import OpenAI
import os
from dotenv import load_dotenv
import traceback
from pydantic import BaseModel
import joblib
import stanza
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()
API_KEY = os.getenv("API_KEY")
if not API_KEY:
    raise ValueError("API_KEY no está definida en el entorno. Por favor, define la variable de entorno API_KEY.")
# Cargar modelo CRF
crf_model = joblib.load("crf_model_fold_3_7.pkl")

# Inicializar Stanza
stanza.download('es', processors='tokenize,pos,lemma')
nlp_stanza = stanza.Pipeline('es')

# Esquemas de petición
class TextRequest(BaseModel):
    text: str

class RecommendRequest(BaseModel):
    premises:    list[str]
    conclusions: list[str]

app = FastAPI(title="CRF + ChatGPT Demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # ajusta orígenes en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/predict")
async def predict(request: TextRequest):
    texto = request.text.strip()
    if not texto:
        raise HTTPException(400, "El campo 'text' no puede estar vacío.")

    # Tokenización
    doc = nlp_stanza(texto)
    tokens = [(w.text, w.upos, None) for s in doc.sentences for w in s.words]

    # Features + predicción
    import features
    feats  = features.sent2features(tokens, ventana=3, incluir_sentimiento=True, lemma=True)
    labels = crf_model.predict_single(feats)
    return {
        "prediction": [
            {"token": tok, "pos": pos, "label": lab}
            for (tok, pos, _), lab in zip(tokens, labels)
        ]
    }

@app.post("/recommend")
async def recommend(req: RecommendRequest):
    client = OpenAI(api_key=API_KEY)
    
    prompt = (
    "Eres un asistente experto en argumentación académica.\n\n"
    "A continuación verás una lista de premisas y conclusiones extraídas de un texto.\n"
    "Para cada elemento, genera **exactamente una** sugerencia clara y práctica que ayude a mejorar esa premisa o conclusión.\n"
    "Las sugerencias deben ser específicas y directamente aplicables.\n"
    "Además, haz un solo párrafo por sugerencia sin agregar titulos ni numeraciones y menciones previas a las premisas o conclusiones.\n\n"
    "Premisas:\n" +
    "\n".join(f"- {p}" for p in req.premises) +
    "\n\nConclusiones:\n" +
    "\n".join(f"- {c}" for c in req.conclusions) +
    "Ahora, genera las sugerencias solicitadas."
    )

    try:
        resp = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "developer", "content": "Eres un experto en argumentación académica. Responde de forma clara y concisa."},
                {"role": "user",   "content": prompt}
            ],
            max_tokens=200,
            temperature=0.7,
        )
        text = resp.choices[0].message.content.strip()

    except Exception as e:
        # Imprime el stack completo en consola
        traceback.print_exc()
        # También imprime e.args
        print("OPENAI ERROR ARGS:", e.args)
        # Devuelve un 502 con el mensaje corto
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al invocar a OpenAI: {str(e)}"
        )

    recs = [line for line in text.split("\n") if line.strip()]
    return {"recommendations": recs}

# Para arrancar:
#   pip install fastapi uvicorn stanza joblib openai sklearn-crfsuite
#   uvicorn main:app --reload

import sys
sys.path.append('.')
from main import generate_tts, TTSPayload
try:
    res = generate_tts(TTSPayload(text='Hello'))
    print("SUCCESS", res)
except Exception as e:
    import traceback
    print("FAILED")
    print(traceback.format_exc())

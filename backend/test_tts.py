import os
import tempfile
import subprocess
import sys

def test_tts(text="Hello world"):
    model_path = os.path.join(os.path.dirname(__file__), "en_US-lessac-medium.onnx")
    config_path = os.path.join(os.path.dirname(__file__), "en_US-lessac-medium.onnx.json")
    
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    
    try:
        process = subprocess.run(
            [sys.executable, "-m", "piper", "-m", model_path, "-c", config_path, "-f", path],
            input=text.encode("utf-8"),
            capture_output=True,
            check=True
        )
        print("Success!", path)
        print("File size:", os.path.getsize(path))
    except subprocess.CalledProcessError as e:
        print("Piper CLI Error:", e.stderr.decode("utf-8") if e.stderr else str(e))
        print("stdout:", e.stdout.decode("utf-8") if e.stdout else "")

if __name__ == "__main__":
    test_tts()

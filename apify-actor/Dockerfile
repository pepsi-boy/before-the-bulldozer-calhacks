FROM apify/actor-python:3.12

USER myuser
COPY --chown=myuser:myuser requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=myuser:myuser . ./
RUN python3 -m compileall -q my_actor/

CMD ["python3", "-m", "my_actor"]

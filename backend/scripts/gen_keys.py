"""
Generate a 2048-bit RSA key pair for JWT signing.
Run: python scripts/gen_keys.py
Writes secrets/jwt_private_key.pem and secrets/jwt_public_key.pem
"""
import pathlib

try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    backend_kwargs = {}
    try:
        from cryptography.hazmat.backends import default_backend
        backend_kwargs = {"backend": default_backend()}
    except ImportError:
        pass

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048, **backend_kwargs)
    priv = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    pub = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    engine = "cryptography"

except ImportError:
    # Fallback: use PyJWT's RSA generation
    try:
        from Crypto.PublicKey import RSA
        key = RSA.generate(2048)
        priv = key.export_key().decode()
        pub = key.publickey().export_key().decode()
        engine = "pycryptodome"
    except ImportError:
        raise SystemExit(
            "ERROR: Install 'cryptography' or 'pycryptodome':\n"
            "  pip install cryptography"
        )

secrets_dir = pathlib.Path(__file__).parent.parent / "secrets"
secrets_dir.mkdir(exist_ok=True)

priv_path = secrets_dir / "jwt_private_key.pem"
pub_path = secrets_dir / "jwt_public_key.pem"

if priv_path.exists():
    print(f"Keys already exist at {secrets_dir} — skipping.")
else:
    priv_path.write_text(priv)
    pub_path.write_text(pub)
    print(f"JWT key pair written to {secrets_dir}/ (engine: {engine})")
    print("NEVER commit these files to version control.")

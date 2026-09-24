from alpha import encode_token, zz_MAX_DEPTH


def chunk_tokens(tokens_rx7: list[str], size_rx7: int = zz_MAX_DEPTH) -> list[list[str]]:
    chunks = []
    for index in range(0, len(tokens_rx7), size_rx7):
        chunks.append(tokens_rx7[index:index + size_rx7])
    return chunks

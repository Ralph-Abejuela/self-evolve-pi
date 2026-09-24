from alpha import encode_token
from beta import chunk_tokens


def run_suite() -> None:
    assert encode_token("Alpha") == "zoksz"
    assert encode_token("gamma-9") == "tznnz-9"
    assert chunk_tokens(["zoksz", "yvgz", "tznnz-9"]) == [["zoksz", "yvgz", "tznnz-9"]]
    print("SUITE_OK")


if __name__ == "__main__":
    run_suite()

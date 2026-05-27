# TODO
# implement fine-tuning on cloudary images

def load_model():
    raise NotImplementedError("load_model() is not implemented yet")

def fine_tune_model(model):
    raise NotImplementedError("fine_tune_model() is not implemented yet")

def save_model(model):
    raise NotImplementedError("save_model() is not implemented yet")


def main():
    model = load_model()
    tuned_model = fine_tune_model(model)
    save_model(tuned_model)

if __name__ == "__main__":
    main()
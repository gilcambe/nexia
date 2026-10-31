let currentStep = 1;
const totalSteps = 4;

function updateProgressBar() {
    const progress = (currentStep / totalSteps) * 100;
    document.querySelector('.progress-bar').style.width = `${progress}%`;
    document.querySelector('.progress-bar').setAttribute('aria-valuenow', progress);
}

function showStep(step) {
    document.querySelectorAll('.form-step').forEach((element) => {
        element.classList.remove('active');
    });
    document.getElementById(`step${step}`).classList.add('active');
    currentStep = step;

    // Update navigation buttons
    document.getElementById('prevBtn').style.display = step === 1 ? 'none' : 'inline-block';
    document.getElementById('nextBtn').style.display = step === totalSteps ? 'none' : 'inline-block';
    document.getElementById('submitBtn').style.display = step === totalSteps ? 'inline-block' : 'none';

    updateProgressBar();
}

function nextStep() {
    if (validateStep(currentStep)) {
        if (currentStep < totalSteps) {
            showStep(currentStep + 1);
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}

function validateStep(step) {
    let isValid = true;
    const stepElement = document.getElementById(`step${step}`);
    const requiredFields = stepElement.querySelectorAll('[required]');

    requiredFields.forEach((field) => {
        if (!field.value.trim()) {
            isValid = false;
            field.classList.add('is-invalid');
        } else {
            field.classList.remove('is-invalid');
        }
    });

    return isValid;
}

function submitQuoteForm(event) {
    event.preventDefault();
    if (validateStep(currentStep)) {
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());

        // Convert checkboxes to an array
        data.servicos = formData.getAll('servicos');

        fetch('/submit-quote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
            alert('Orçamento enviado com sucesso!');
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao enviar o orçamento.');
        });
    }
}

// Initialize the form
document.addEventListener('DOMContentLoaded', () => {
    showStep(1);
});

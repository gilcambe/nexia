#!/bin/bash

# Define the directories to search
directories=("public" "apps" "nexia-ai/site-kit" "viajante-pro")

# Define the patterns and replacements
patterns=(
    "NEXIA CORTEX — Plataforma de IA" "Cortex — Plataforma de IA"
    "<title>.*NEXIA.*</title>" "<title>Cortex</title>"
    "og:site_name.*NEXIA.*" "og:site_name=\"Cortex\""
    "NEXIA" "Cortex"
)

# Loop through each directory
for dir in "${directories[@]}"; do
    # Find all HTML files in the directory and its subdirectories
    find "$dir" -type f -name "*.html" | while read -r file; do
        # Loop through each pattern and replacement
        for ((i=0; i<${#patterns[@]}; i+=2)); do
            # Get the pattern and replacement
            pattern="${patterns[i]}"
            replacement="${patterns[i+1]}"

            # Use sed to replace the pattern with the replacement in the file
            sed -i "s/$pattern/$replacement/g" "$file"
        done
    done
done

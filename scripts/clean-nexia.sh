#!/bin/bash

# Define the directories to search
directories=("public" "apps" "nexia-ai/site-kit" "viajante-pro")

# Define the patterns and replacements
patterns=(
    "NEXIA CORTEX — Plataforma de IA" "Cortex — Plataforma de IA"
    "<title>.*NEXIA.*</title>" "<title>Cortex</title>"
    "og:site_name=\"[^\"]*NEXIA[^\"]*\"" "og:site_name=\"Cortex\""
    "<title>[^<]*NEXIA[^<]*</title>" "<title>Cortex</title>"
    "og:site_name='[^']*NEXIA[^']*'" "og:site_name='Cortex'"
)

# Loop through each directory
for dir in "${directories[@]}"; do
    # Find all HTML files in the directory and its subdirectories
    find "$dir" -type f -name "*.html" | while read -r file; do
        # Create a temporary file to store the modified content
        temp_file=$(mktemp)

        # Loop through each pattern and replacement
        for ((i=0; i<${#patterns[@]}; i+=2)); do
            # Get the pattern and replacement
            pattern="${patterns[i]}"
            replacement="${patterns[i+1]}"

            # Use sed to replace the pattern with the replacement in the file
            sed "s/$pattern/$replacement/g" "$file" > "$temp_file"
            mv "$temp_file" "$file"
        done
    done
done

# Additional step to remove NEXIA from other attributes or texts within <title> or og:site_name
for dir in "${directories[@]}"; do
    find "$dir" -type f -name "*.html" | while read -r file; do
        sed -i 's/<title>\(.*\)NEXIA\(.*\)<\/title>/<title>\1Cortex\2<\/title>/g' "$file"
        sed -i 's/og:site_name="\([^^"]*\)NEXIA\([^^"]*\)"/og:site_name="Cortex"/g' "$file"
        sed -i "s/og:site_name='\([^^']*\)NEXIA\([^^']*\)'/og:site_name='Cortex'/g" "$file"
    done
done

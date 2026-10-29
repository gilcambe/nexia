<template>
  <div class="site-preview-container">
    <iframe
      :src="previewUrl"
      class="site-preview-iframe"
      frameborder="0"
      allowfullscreen
    ></iframe>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';

export default defineComponent({
  name: 'SitePreview',
  props: {
    siteSpec: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const previewUrl = computed(() => {
      // Encode the site spec as a query parameter
      const encodedSpec = encodeURIComponent(JSON.stringify(props.siteSpec));
      return `https://preview.nexia.dev?spec=${encodedSpec}`;
    });

    return {
      previewUrl,
    };
  },
});
</script>

<style scoped>
.site-preview-container {
  width: 100%;
  height: 600px;
  margin-top: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.site-preview-iframe {
  width: 100%;
  height: 100%;
}
</style>

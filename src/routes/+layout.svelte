<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="flex h-screen w-screen flex-col items-center">
	<div class="h-full w-full max-w-[48rem]">
		{@render children()}
	</div>
</div>

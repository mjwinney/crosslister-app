<div
	class="modal fade"
	id="signInModal"
	tabindex="-1"
	aria-labelledby="signInModalLabel"
	aria-hidden="true"
>
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title" id="signInModalLabel">Sign In</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body">
				<!-- Your sign-in form elements go here -->
				<form>
					<div class="mb-3">
						<label for="emailInput" class="form-label">Email address</label>
						<input type="email" class="form-control" id="emailInput" aria-describedby="emailHelp" />
					</div>
					<div class="mb-3">
						<label for="passwordInput" class="form-label">Password</label>
						<input type="password" class="form-control" id="passwordInput" />
					</div>
					<button type="submit" class="btn btn-primary">Submit</button>
				</form>
			</div>
            <div class="modal-footer">
                <a href="#" class="btn btn-link" data-bs-toggle="modal" data-bs-target="#registerModal">Register</a>
                <a href="#" class="btn btn-link">Forgot password?</a>
            </div>
		</div>
	</div>
</div>
